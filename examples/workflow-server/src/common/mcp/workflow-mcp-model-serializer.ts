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

/**
 * As compared to the {@link DefaultMcpModelSerializer}, this is a specific implementation and we
 * know not only the structure of our graph but also each relevant attribute. This enables us to
 * order them semantically so the produced serialization makes more sense if read with semantics
 * mind. As LLMs (i.e., the MCP clients) work semantically, this is superior to a random ordering.
 * Furthermore, including only the relevant information without redundancies decreases context size.
 */
@injectable()
export class WorkflowMcpModelSerializer extends DefaultMcpModelSerializer {
    override serialize(element: GModelElement): string {
        const elementsByType = this.prepareElement(element);

        return Object.entries(elementsByType)
            .flatMap(([type, elements]) => [`# ${type}`, objectArrayToMarkdownTable(elements)])
            .join('\n');
    }

    override prepareElement(element: GModelElement): Record<string, Record<string, any>[]> {
        const elements = this.flattenStructure(element);

        // Define the order of keys
        const result: Record<string, Record<string, any>[]> = {
            [DefaultTypes.GRAPH]: [],
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
        });

        return result;
    }

    private adjustElement(element: Record<string, any>): Record<string, any> | undefined {
        switch (element.type) {
            case ModelTypes.AUTOMATED_TASK:
            case ModelTypes.MANUAL_TASK: {
                const label = element.children.find((child: { type: string }) => child.type === ModelTypes.LABEL_HEADING);

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
                    parentId: element.parent.type === ModelTypes.STRUCTURE ? element.parent.parent.id : element.parentId
                };
            }
            case ModelTypes.CATEGORY: {
                const label = element.children
                    .find((child: { type: string }) => child.type === ModelTypes.COMP_HEADER)
                    ?.children.find((child: { type: string }) => child.type === ModelTypes.LABEL_HEADING);

                const labelSize = {
                    width: Math.trunc(label.size.width + 20),
                    height: Math.trunc(label.size.height + 20)
                };

                const usableSpaceSize = {
                    width: Math.trunc(Math.max(0, element.size.width - 10)),
                    height: Math.trunc(Math.max(0, element.size.height - labelSize.height - 10))
                };

                return {
                    id: element.id,
                    isContainer: true,
                    position: element.position,
                    size: element.size,
                    bounds: element.bounds,
                    label: label.text,
                    labelSize: labelSize,
                    usableSpaceSize: usableSpaceSize,
                    parentId: element.parentId
                };
            }
            case ModelTypes.JOIN_NODE:
            case ModelTypes.MERGE_NODE:
            case ModelTypes.DECISION_NODE:
            case ModelTypes.FORK_NODE: {
                return {
                    id: element.id,
                    position: element.position,
                    size: element.size,
                    bounds: element.bounds,
                    parentId: element.parentId
                };
            }
            case DefaultTypes.EDGE: {
                return {
                    id: element.id,
                    sourceId: element.sourceId,
                    targetId: element.targetId,
                    parentId: element.parentId
                };
            }
            case ModelTypes.WEIGHTED_EDGE: {
                return {
                    id: element.id,
                    sourceId: element.sourceId,
                    targetId: element.targetId,
                    probability: element.probability,
                    parentId: element.parentId
                };
            }
            case DefaultTypes.GRAPH: {
                return {
                    id: element.id,
                    isContainer: true
                };
            }
            default:
                return undefined;
        }
    }
}
