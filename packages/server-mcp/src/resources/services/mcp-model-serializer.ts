/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { GModelElement } from '@eclipse-glsp/graph';
import { GModelSerializer } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { objectArrayToMarkdownTable } from '../../util';

export const McpModelSerializer = Symbol('McpModelSerializer');

/**
 * The `McpModelSerializer` is used to transform a graphical model into an appropriately formatted string
 * for communicating with an LLM. It is recommended to use Markdown or simply JSON for this purpose.
 */
export interface McpModelSerializer {
    /**
     * Transforms the given {@link GModelElement} into a string representation.
     * @param element The element that should be serialized.
     * @returns The transformed string.
     */
    serialize(element: GModelElement): string;
}

@injectable()
export class DefaultMcpModelSerializer implements McpModelSerializer {
    @inject(GModelSerializer)
    protected gModelSerialzer: GModelSerializer;

    protected keysToRemove: string[] = [
        'cssClasses',
        'revision',
        'layout',
        'args',
        'layoutOptions',
        'alignment',
        'children',
        'routingPoints',
        'resizeLocations',
        'parent'
    ];

    serialize(element: GModelElement): string {
        const elementsByType = this.prepareElement(element);

        return Object.entries(elementsByType)
            .flatMap(([type, elements]) => [`# ${type}`, objectArrayToMarkdownTable(elements)])
            .join('\n');
    }

    protected prepareElement(element: GModelElement): Record<string, Record<string, any>[]> {
        const schema = this.gModelSerialzer.createSchema(element);

        const elements = this.flattenStructure(schema, element.parent?.id);

        const result: Record<string, Record<string, any>[]> = {};
        elements.forEach(element => {
            this.removeKeys(element);
            this.combinePositionAndSize(element);
            if (result[element.type] === undefined) {
                result[element.type] = [];
            }
            result[element.type].push(element);
        });

        return result;
    }

    protected flattenStructure(schema: Record<string, any>, parentId?: string): Record<string, any>[] {
        const result: Record<string, any>[] = [];

        result.push(schema);
        if (schema.children !== undefined) {
            schema.children
                .flatMap((child: Record<string, any>) => this.flattenStructure(child, schema.id))
                .forEach((element: Record<string, any>) => result.push(element));
        }
        schema.parentId = parentId;

        return result;
    }

    protected removeKeys(schema: Record<string, any>): void {
        for (const key in schema) {
            if (this.keysToRemove.includes(key)) {
                delete schema[key];
            }
        }
    }

    protected combinePositionAndSize(schema: Record<string, any>): void {
        const position = schema.position;
        if (position) {
            // Not all positioned elements necessarily possess a size
            const size = schema.size ?? { width: 0, height: 0 };

            const x = Math.trunc(position.x);
            const y = Math.trunc(position.y);
            const width = Math.trunc(size.width);
            const height = Math.trunc(size.height);

            // Only expose the truncated sizes for smaller context size at irrelevant precision loss
            schema['position'] = { x, y };
            schema['size'] = { width, height };

            // Add bounds in addition to position and size to reduce derived calculations
            schema['bounds'] = {
                left: x,
                right: x + width,
                top: y,
                bottom: y + height
            };
        }
    }
}
