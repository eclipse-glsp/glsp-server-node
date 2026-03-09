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
import { DefaultTypes } from '@eclipse-glsp/server';
import { DefaultMcpModelSerializer, objectArrayToMarkdownTable } from '@eclipse-glsp/server-mcp';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';

@injectable()
export class WorkflowMcpModelSerializer extends DefaultMcpModelSerializer {
    override keysToRemove: string[] = [
        'type',
        'cssClasses',
        'revision',
        'layout',
        'args',
        'layoutOptions',
        'alignment',
        'children',
        'routingPoints',
        'resizeLocations',
        'taskType',
        'nodeType'
    ];

    override serialize(element: GModelElement): string {
        const elementsByType = this.prepareElement(element);

        return Object.entries(elementsByType)
            .flatMap(([type, elements]) => [`# ${type}`, objectArrayToMarkdownTable(elements)])
            .join('\n');
    }

    override prepareElement(element: GModelElement): Record<string, Record<string, any>[]> {
        const schema = this.gModelSerialzer.createSchema(element);

        const elements = this.flattenStructure(schema, element.parent?.id);

        // Define the order of keys
        const result: Record<string, Record<string, any>[]> = {
            [ModelTypes.CATEGORY]: [],
            [ModelTypes.AUTOMATED_TASK]: [],
            [ModelTypes.MANUAL_TASK]: [],
            [ModelTypes.FORK_NODE]: [],
            [ModelTypes.JOIN_NODE]: [],
            [ModelTypes.DECISION_NODE]: [],
            [ModelTypes.MERGE_NODE]: [],
            [DefaultTypes.EDGE]: [],
            [ModelTypes.WEIGHTED_EDGE]: []
        };
        elements.forEach(element => {
            this.combinePositionAndSize(element);

            const adjustedElement = this.adjustElement(element);
            if (!adjustedElement) {
                return;
            }

            result[element.type].push(adjustedElement);

            this.removeKeys(adjustedElement);
        });

        return result;
    }

    private adjustElement(element: Record<string, any>): Record<string, any> | undefined {
        if ([ModelTypes.AUTOMATED_TASK, ModelTypes.MANUAL_TASK].includes(element.type)) {
            const label = element.children.find((child: { type: string }) => child.type.startsWith('label'));

            // For tasks, the only content with impact on element size is the label
            // Therefore, all other factors get integrated into the label size for the AI to do proper resizing operations
            const labelSize = {
                // 10px padding right, 31px padding left (incl. icon)
                width: Math.trunc(label.size.width + 10 + 31),
                // 7px padding top and bottom each
                height: Math.trunc(label.size.height + 14)
            };

            return {
                id: element.id,
                position: element.position,
                size: element.size,
                bounds: element.bounds,
                label: label.text,
                labelSize: labelSize,
                parent: element.parent
            };
        }

        if ([ModelTypes.CATEGORY].includes(element.type)) {
            const label = element.children.find((child: { type: string }) => child.type.startsWith('label'));

            const labelSize = {
                width: Math.trunc(label.size.width + 20),
                height: Math.trunc(label.size.height + 20)
            };

            const usableSpaceSize = {
                width: Math.trunc(element.size - 10),
                height: Math.trunc(Math.max(0, element.size - labelSize.height - 10))
            };

            return {
                id: element.id,
                position: element.position,
                size: element.size,
                bounds: element.bounds,
                label: label.text,
                labelSize: labelSize,
                usableSpaceSize: usableSpaceSize,
                parent: element.parent
            };
        }

        if ([ModelTypes.JOIN_NODE, ModelTypes.MERGE_NODE, ModelTypes.DECISION_NODE, ModelTypes.FORK_NODE].includes(element.type)) {
            return {
                id: element.id,
                position: element.position,
                size: element.size,
                bounds: element.bounds,
                parent: element.parent
            };
        }

        // elements to exclude
        if (
            [
                ModelTypes.ICON,
                ModelTypes.LABEL_HEADING,
                ModelTypes.LABEL_ICON,
                ModelTypes.LABEL_TEXT,
                ModelTypes.STRUCTURE,
                ModelTypes.COMP_HEADER
            ].includes(element.type)
        ) {
            return undefined;
        }

        return element;
    }
}
