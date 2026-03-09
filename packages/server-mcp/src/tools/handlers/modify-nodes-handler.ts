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

import {
    ApplyLabelEditOperation,
    ChangeBoundsOperation,
    ClientSessionManager,
    GLabel,
    GShapeElement,
    Logger,
    ModelState
} from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Modifies a specific nodes in the given session's model.
 */
@injectable()
export class ModifyNodesMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'modify-nodes',
            {
                description:
                    'Modify one or more node elements in the diagram. ' +
                    "When modifying the node's position or size, absolutely consider the visual alignment with other nodes. " +
                    'This operation modifies the diagram state and requires user approval.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID in which the node should be modified'),
                    changes: z
                        .array(
                            z.object({
                                elementId: z.string().describe('Element ID that should be modified.'),
                                position: z
                                    .object({
                                        x: z.number().describe('X coordinate in diagram space'),
                                        y: z.number().describe('Y coordinate in diagram space')
                                    })
                                    .optional()
                                    .describe('Position where the node should be moved to (absolute diagram coordinates)'),
                                size: z
                                    .object({
                                        width: z.number().describe('Width of the element in diagram space'),
                                        height: z.number().describe('Height of the element in diagram space')
                                    })
                                    .optional()
                                    .describe('New size of the node'),
                                text: z
                                    .string()
                                    .optional()
                                    .describe("Label text to use instead (given that the element's type allows for labels).")
                            })
                        )
                        .min(1)
                        .describe(
                            'Array of change objects containing an element ID and their intended changes. Must include at least one change.'
                        )
                }
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        changes
    }: {
        sessionId: string;
        changes?: { elementId: string; position?: { x: number; y: number }; size?: { width: number; height: number }; text?: string }[];
    }): Promise<CallToolResult> {
        this.logger.info(`ModifyNodesMcpToolHandler invoked for session ${sessionId}`);
        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!changes || !changes.length) {
            return createToolResult('No changes provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('No active session found for this session id.', true);
        }

        const modelState = session.container.get<ModelState>(ModelState);
        if (modelState.isReadonly) {
            return createToolResult('Model is read-only', true);
        }

        // Map the list of changes to their underlying element
        const elements: [(typeof changes)[number], GShapeElement][] = changes.map(change => [
            change,
            modelState.index.find(change.elementId) as GShapeElement
        ]);

        // If any element could not be resolved, do not proceed
        const undefinedElements = elements.filter(([change, element]) => !element).map(([change]) => change.elementId);
        if (undefinedElements.length) {
            return createToolResult(`No elements found for the following element ids: ${undefinedElements}`, true);
        }

        // Do all dispatches in parallel, as they should not interfere with each other
        const promises: Promise<void>[] = [];
        elements.forEach(([change, element]) => {
            const { elementId, size, position, text } = change;

            // Resize and/or move the affected node if applicable
            if (size || position) {
                const newSize = size ?? element.size;
                const newPosition = position ?? element.position;

                const operation = ChangeBoundsOperation.create([{ elementId, newSize, newPosition }]);
                promises.push(session.actionDispatcher.dispatch(operation));
            }

            // Change the label if applicable
            const newElementLabelId = this.getCorrespondingLabelId(element);
            if (newElementLabelId && text) {
                const editLabelOperation = ApplyLabelEditOperation.create({ labelId: newElementLabelId, text });
                promises.push(session.actionDispatcher.dispatch(editLabelOperation));
            }
        });

        // Wait for all dispatches to finish before notifying the caller
        await Promise.all(promises);

        return createToolResult('Nodes succesfully modified', false);
    }

    protected getCorrespondingLabelId(element: GShapeElement): string | undefined {
        // Assume that generally, labelled nodes have those labels as direct children
        return element.children.find(child => child instanceof GLabel)?.id;
    }
}
