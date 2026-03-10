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
    ChangeRoutingPointsOperation,
    ClientSessionManager,
    GLabel,
    GShapeElement,
    Logger,
    ModelState,
    ReconnectEdgeOperation
} from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Modifies onr or more edges in the given session's model.
 */
@injectable()
export class ModifyEdgesMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'modify-edges',
            {
                description:
                    'Modify one or more edge elements in the diagram. ' +
                    'This operation modifies the diagram state and requires user approval.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID in which the node should be modified'),
                    changes: z
                        .array(
                            z.object({
                                elementId: z.string().describe('Element ID that should be modified.'),
                                sourceElementId: z.string().optional().describe('ID of the source element (must exist in the diagram)'),
                                targetElementId: z.string().optional().describe('ID of the target element (must exist in the diagram)'),
                                routingPoints: z
                                    .array(
                                        z.object({
                                            x: z.number().describe('Routing point x coordinate'),
                                            y: z.number().describe('Routing point y coordinate')
                                        })
                                    )
                                    .optional()
                                    .describe(
                                        'Optional array of routing point coordinates that allow for a complex edge path. ' +
                                            'Using an empty array removes all routing points.'
                                    )
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
        changes: { elementId: string; sourceElementId?: string; targetElementId?: string; routingPoints?: { x: number; y: number }[] }[];
    }): Promise<CallToolResult> {
        this.logger.info(`'modify-nodes' invoked for session '${sessionId}' with ${changes.length} changes`);

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
        // As compared to the create operations, changes can be done in bulk, i.e., in a single transaction
        const undefinedElements = elements.filter(([change, element]) => !element).map(([change]) => change.elementId);
        if (undefinedElements.length) {
            return createToolResult(`No edges found for the following element ids: ${undefinedElements}`, true);
        }

        // Do all dispatches in parallel, as they should not interfere with each other
        const promises: Promise<void>[] = [];
        const errors: string[] = [];
        elements.forEach(([change, element]) => {
            const { elementId, sourceElementId, targetElementId, routingPoints } = change;

            // Filter incomplete change requests
            if ((sourceElementId && !targetElementId) || (!sourceElementId && targetElementId)) {
                errors.push(`Both source and target ID are required for input: ${JSON.stringify(change)}`);
                return;
            }

            // Reconnect an edge if required
            if (sourceElementId && targetElementId) {
                const source = modelState.index.find(sourceElementId);
                if (!source) {
                    errors.push(`Source element not found: ${sourceElementId}`);
                    return;
                }
                const target = modelState.index.find(targetElementId);
                if (!target) {
                    errors.push(`Target element not found: ${targetElementId}`);
                    return;
                }

                const operation = ReconnectEdgeOperation.create({ edgeElementId: elementId, sourceElementId, targetElementId });
                promises.push(session.actionDispatcher.dispatch(operation));
                // It doesn't make much sense to add routing points while reconnecting an edge
                return;
            }

            // Change routing points if required
            if (routingPoints) {
                const operation = ChangeRoutingPointsOperation.create([{ elementId, newRoutingPoints: routingPoints }]);
                promises.push(session.actionDispatcher.dispatch(operation));
            }
        });

        // Wait for all dispatches to finish before notifying the caller
        await Promise.all(promises);

        // Create a failure string if any errors occurred
        let failureStr = '';
        if (errors.length) {
            const failureListStr = errors.map(error => `- ${error}\n`);
            failureStr = `\nThe following errors occured:\n${failureListStr}`;
        }

        return createToolResult(`Succesfully modified ${changes.length} edge(s) (in ${promises.length} commands)${failureStr}`, false);
    }

    /**
     * This method provides the label ID for a labelled node's label.
     *
     * While it can be generally assumed that labelled nodes contain those labels
     * as direct children, some custom elements may wrap their labels in intermediary
     * container nodes. However, in the likely scenario that a specific GLSP implementation
     * requires no further changes to this handler except extracting nested labels, this
     * function serves as an easy entrypoint without a full override.
     */
    protected getCorrespondingLabelId(element: GShapeElement): string | undefined {
        return element.children.find(child => child instanceof GLabel)?.id;
    }
}
