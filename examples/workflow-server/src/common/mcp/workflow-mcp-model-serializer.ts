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
import { Dimension, DefaultTypes } from '@eclipse-glsp/server';
import { MarkdownMcpModelSerializer, SerializedElement } from '@eclipse-glsp/server-mcp';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';

/**
 * As compared to the {@link MarkdownMcpModelSerializer}, this is a specific implementation and we
 * know not only the structure of our graph but also each relevant attribute. This enables us to
 * order them semantically so the produced serialization makes more sense if read with semantics
 * mind. As LLMs (i.e., the MCP clients) work semantically, this is superior to a random ordering.
 * Furthermore, including only the relevant information without redundancies decreases context size.
 */
@injectable()
export class WorkflowMcpModelSerializer extends MarkdownMcpModelSerializer {
    override prepareElement(element: GModelElement): Record<string, SerializedElement[]> {
        // Pass the live parent's id so the input element gets `parentId` set even when the
        // spread inside `flattenStructure` doesn't carry the (typically non-enumerable) `parent`
        // reference. Without this, `query-elements` inspect on a single leaf drops `parentId`,
        // creating an inconsistency with `diagram-model`.
        const elements = this.flattenStructure(element as unknown as SerializedElement, element.parent?.id);

        // Define the order of keys
        const result: Record<string, SerializedElement[]> = {
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
        elements.forEach(serialized => {
            this.combinePositionAndSize(serialized);

            const adjustedElement = this.adjustElement(serialized);
            if (!adjustedElement) {
                return;
            }

            const type = serialized.type;
            if (typeof type === 'string' && result[type]) {
                result[type].push(adjustedElement);
            }
        });

        return result;
    }

    private adjustElement(element: SerializedElement): SerializedElement | undefined {
        const type = element.type;
        switch (type) {
            case ModelTypes.AUTOMATED_TASK:
            case ModelTypes.MANUAL_TASK: {
                const children = Array.isArray(element.children) ? (element.children as SerializedElement[]) : [];
                const label = children.find(child => child.type === ModelTypes.LABEL_HEADING);
                if (!label || !Dimension.is(label.size)) {
                    return undefined;
                }

                // For tasks, the only content with impact on element size is the label
                // Therefore, all other factors get integrated into the label size for the AI to do proper resizing operations
                const labelSize = {
                    // 10px padding right, 31px padding left (incl. icon)
                    width: Math.trunc(label.size.width + 10 + 31),
                    // 7px padding top and bottom each
                    height: Math.trunc(label.size.height + 14)
                };

                // If the task lives inside a `STRUCTURE` (a layout-only wrapper), report the
                // structure's parent as the logical parent. Falls back to the direct `parentId`
                // when the task is at the root or the structure has no parent.
                const liveParent = (element as { parent?: GModelElement }).parent;
                const parentId = liveParent?.type === ModelTypes.STRUCTURE ? liveParent.parent?.id ?? element.parentId : element.parentId;
                return {
                    id: element.id,
                    type,
                    position: element.position,
                    size: element.size,
                    bounds: element.bounds,
                    label: label.text,
                    labelSize,
                    parentId
                };
            }
            case ModelTypes.CATEGORY: {
                const children = Array.isArray(element.children) ? (element.children as SerializedElement[]) : [];
                const header = children.find(child => child.type === ModelTypes.COMP_HEADER);
                const headerChildren = header && Array.isArray(header.children) ? (header.children as SerializedElement[]) : [];
                const label = headerChildren.find(child => child.type === ModelTypes.LABEL_HEADING);
                if (!label || !Dimension.is(label.size)) {
                    return undefined;
                }

                const labelSize = {
                    width: Math.trunc(label.size.width + 20),
                    height: Math.trunc(label.size.height + 20)
                };

                // `combinePositionAndSize` (in MarkdownMcpModelSerializer) omits `size`/`bounds`
                // when an element has no explicit geometry yet, so the LLM doesn't try to "fix"
                // placeholder bounds. Categories normally do have an explicit size in the model,
                // but if a freshly created (or otherwise unsized) category lands here, skip the
                // derived `usableSpaceSize` rather than crashing on `element.size.width`.
                const usableSpaceSize = Dimension.is(element.size)
                    ? {
                          width: Math.trunc(Math.max(0, element.size.width - 10)),
                          height: Math.trunc(Math.max(0, element.size.height - labelSize.height - 10))
                      }
                    : undefined;

                return {
                    id: element.id,
                    type,
                    isContainer: true,
                    position: element.position,
                    size: element.size,
                    bounds: element.bounds,
                    label: label.text,
                    labelSize,
                    usableSpaceSize,
                    parentId: element.parentId
                };
            }
            case ModelTypes.JOIN_NODE:
            case ModelTypes.MERGE_NODE:
            case ModelTypes.DECISION_NODE:
            case ModelTypes.FORK_NODE: {
                return {
                    id: element.id,
                    type,
                    position: element.position,
                    size: element.size,
                    bounds: element.bounds,
                    parentId: element.parentId
                };
            }
            case DefaultTypes.EDGE: {
                return {
                    id: element.id,
                    type,
                    sourceId: element.sourceId,
                    targetId: element.targetId,
                    parentId: element.parentId
                };
            }
            case ModelTypes.WEIGHTED_EDGE: {
                return {
                    id: element.id,
                    type,
                    sourceId: element.sourceId,
                    targetId: element.targetId,
                    probability: element.probability,
                    parentId: element.parentId
                };
            }
            case DefaultTypes.GRAPH: {
                return {
                    id: element.id,
                    type,
                    isContainer: true
                };
            }
            default:
                return undefined;
        }
    }
}
