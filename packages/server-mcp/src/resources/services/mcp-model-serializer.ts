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
     * @param aliasFn Optional function to alias an ID according to `McpIdAliasService`
     * @returns The transformed string and the underlying flattened graph object.
     */
    serialize(element: GModelElement, aliasFn?: (id: string) => string): [string, Record<string, Record<string, any>[]>];

    /**
     * Transforms the given {@link GModelElement} items into a string representation.
     * It is assumed that they represent a subgraph of the total graph and duplicate elements, e.g,
     * by hierarchy, are removed.
     * @param elements The elements that should be serialized.
     * @param aliasFn Optional function to alias an ID according to `McpIdAliasService`
     * @returns The transformed string and the underlying flattened graph object.
     */
    serializeArray(elements: GModelElement[], aliasFn?: (id: string) => string): [string, Record<string, Record<string, any>[]>];
}

/**
 * The `DefaultMcpModelSerializer` transforms the graph into a canonically serializable
 * format (as produced by `GModelSerializer`), flattens the graph structure into a list of elements,
 * removes unnecessary information, and finally adds some derived visual information.
 *
 * It can only do so in a generic manner without control of the order of elements or element attributes,
 * since no details of a specific GLSP implementation are known.
 */
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

    serialize(element: GModelElement, aliasFn?: (id: string) => string): [string, Record<string, Record<string, any>[]>] {
        return this.serializeArray([element], aliasFn);
    }

    serializeArray(elements: GModelElement[], aliasFn?: (id: string) => string): [string, Record<string, Record<string, any>[]>] {
        const elementsByTypeArray = elements.map(element => this.prepareElement(element));

        const result: Record<string, Record<string, any>[]> = {};

        const allKeys = new Set(elementsByTypeArray.flatMap(obj => Object.keys(obj)));

        allKeys.forEach(key => {
            const combined = elementsByTypeArray.flatMap(obj => obj[key] || []);

            result[key] = Array.from(new Map(combined.map(item => [item.id, item])).values()).map(item => this.applyAlias(item, aliasFn));
        });

        return [
            Object.entries(result)
                .flatMap(([type, elements]) => [`# ${type}`, objectArrayToMarkdownTable(elements)])
                .join('\n'),
            result
        ];
    }

    protected applyAlias(element: Record<string, any>, aliasFn?: (id: string) => string): Record<string, any> {
        if (element.id) {
            element.id = aliasFn?.(element.id);
        }
        if (element.sourceId) {
            element.sourceId = aliasFn?.(element.sourceId);
        }
        if (element.targetId) {
            element.targetId = aliasFn?.(element.targetId);
        }
        if (element.parentId) {
            element.parentId = aliasFn?.(element.parentId);
        }
        return element;
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

    protected flattenStructure(element: Record<string, any>, parentId?: string): Record<string, any>[] {
        const newElement = { ...element };

        const result: Record<string, any>[] = [];

        result.push(newElement);
        if (newElement.children !== undefined) {
            newElement.children
                .flatMap((child: Record<string, any>) => this.flattenStructure(child, newElement.id))
                .forEach((element: Record<string, any>) => result.push(element));
        }
        newElement.parentId = parentId;

        return result;
    }

    protected removeKeys(element: Record<string, any>): void {
        for (const key in element) {
            if (this.keysToRemove.includes(key)) {
                delete element[key];
            }
        }
    }

    protected combinePositionAndSize(element: Record<string, any>): void {
        const position = element.position;
        if (position) {
            // Not all positioned elements necessarily possess a size
            const size = element.size ?? { width: 0, height: 0 };

            const x = Math.trunc(position.x);
            const y = Math.trunc(position.y);
            const width = Math.trunc(size.width);
            const height = Math.trunc(size.height);

            // Only expose the truncated sizes for smaller context size at irrelevant precision loss
            element['position'] = { x, y };
            element['size'] = { width, height };

            // Add bounds in addition to position and size to reduce derived calculations
            element['bounds'] = {
                left: x,
                right: x + width,
                top: y,
                bottom: y + height
            };
        }
    }
}
