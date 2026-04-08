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

import { ChangeRoutingPointsOperation, ClientSessionManager, CreateEdgeOperation, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpIdAliasService, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates one or multiple new edges in the given session's model.
 */
@injectable()
export class CreateEdgesMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-edges',
            {
                description:
                    'Create one or multiple new edges connecting two elements in the diagram. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Query glsp://types/{diagramType}/elements resource to discover valid edge type IDs.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the edge should be created'),
                    edges: z
                        .array(
                            z.object({
                                elementTypeId: z
                                    .string()
                                    .describe(
                                        'Edge type ID (e.g., "edge", "transition"). Use element-types resource to discover valid IDs.'
                                    ),
                                sourceElementId: z.string().describe('ID of the source element (must exist in the diagram)'),
                                targetElementId: z.string().describe('ID of the target element (must exist in the diagram)'),
                                routingPoints: z
                                    .array(
                                        z.object({
                                            x: z.number().describe('Routing point x coordinate'),
                                            y: z.number().describe('Routing point y coordinate')
                                        })
                                    )
                                    .optional()
                                    .describe('Optional array of routing point coordinates that allow for a complex edge path.'),
                                args: z
                                    .record(z.string(), z.any())
                                    .optional()
                                    .describe('Additional type-specific arguments for edge creation (varies by edge type)')
                            })
                        )
                        .min(1)
                        .describe('Array of edges to create. Must include at least one node.')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        edges
    }: {
        sessionId: string;
        edges: {
            elementTypeId: string;
            sourceElementId: string;
            targetElementId: string;
            routingPoints?: { x: number; y: number }[];
            args?: Record<string, any>;
        }[];
    }): Promise<CallToolResult> {
        this.logger.info(`'create-edges' invoked for session '${sessionId}' with ${edges.length} edges`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!edges || !edges.length) {
            return createToolResult('No edges provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('Session not found', true);
        }

        const modelState = session.container.get<ModelState>(ModelState);
        if (modelState.isReadonly) {
            return createToolResult('Model is read-only', true);
        }

        const mcpIdAliasService = session.container.get<McpIdAliasService>(McpIdAliasService);

        // Snapshot element IDs before operation
        let beforeIds = modelState.index.allIds();

        const errors: string[] = [];
        const successIds: string[] = [];
        let dispatchedOperations = 0;
        // Since we need sequential handling of the created elements, we can't call all in parallel
        for (const edge of edges) {
            const { elementTypeId, routingPoints, args } = edge;
            const sourceElementId = mcpIdAliasService.lookup(sessionId, edge.sourceElementId);
            const targetElementId = mcpIdAliasService.lookup(sessionId, edge.targetElementId);

            // Validate source and target exist
            const source = modelState.index.find(sourceElementId);
            if (!source) {
                errors.push(`Source element not found: ${sourceElementId}`);
                continue;
            }
            const target = modelState.index.find(targetElementId);
            if (!target) {
                errors.push(`Target element not found: ${targetElementId}`);
                continue;
            }

            // Create & dispatch the operation
            const operation = CreateEdgeOperation.create({ elementTypeId, sourceElementId, targetElementId, args });
            // Wait for the operation to be handled so the new ID is present
            await session.actionDispatcher.dispatch(operation);
            dispatchedOperations++;

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID by filtering only the newly added ones,...
            const newIds = afterIds.filter(id => !beforeIds.includes(id));
            // ...find the new elements that are of the same type as the created element,
            const newElements = newIds.map(id => modelState.index.find(id)).filter(element => element?.type === elementTypeId);
            // ...and in case that multiple exist (which should never be the case),
            // assume that the first new element represents the actually relevant element
            const newElementId = newElements.length > 0 ? newElements[0]?.id : undefined;
            // Log a warning in case that multiple elements of the same type were created
            if (newElements.length > 1) {
                this.logger.warn('More than 1 new element created');
            }

            // For the next iteration, use the new snapshot as the baseline
            beforeIds = afterIds;

            // We can't directly know whether an operation failed, because there are no
            // direct responses, but if we see no new ID, we can assume it failed
            if (!newElementId) {
                errors.push(`Edge creation likely failed because no new element ID was found for input: ${JSON.stringify(edge)}`);
                continue;
            }

            if (routingPoints) {
                const routingPointsOperation = ChangeRoutingPointsOperation.create([
                    { elementId: newElementId, newRoutingPoints: routingPoints }
                ]);
                await session.actionDispatcher.dispatch(routingPointsOperation);
                dispatchedOperations++;
            }

            successIds.push(mcpIdAliasService.alias(sessionId, newElementId));
        }

        // Create a failure string if any errors occurred
        let failureStr = '';
        if (errors.length) {
            const failureListStr = errors.map(error => `- ${error}\n`);
            failureStr = `\nThe following errors occured:\n${failureListStr}`;
        }

        const successListStr = successIds.map(successId => `- ${successId}`).join('\n');
        // Even if every input given yields an error, the MCP call was still successful technically (even if not semantically)
        // Otherwise, we would need some kind of transaction to rollback successful creations, which would be a great technical challenge
        return createToolResult(
            `Successfully created ${successIds.length} edge(s) (in ${dispatchedOperations} commands) ` +
                `with element IDs:\n${successListStr}${failureStr}`,
            false
        );
    }
}
