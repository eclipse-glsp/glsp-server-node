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

import { ClientSessionManager, CreateEdgeOperation, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates a new edge in the given session's model.
 */
@injectable()
export class CreateEdgeMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-edge',
            {
                description:
                    'Create a new edge connecting two elements in the diagram. ' +
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
        edges: { elementTypeId: string; sourceElementId: string; targetElementId: string; args?: Record<string, any> }[];
    }): Promise<CallToolResult> {
        this.logger.info(`CreateEdgeMcpToolHandler invoked for session ${sessionId}`);

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolResult('Session not found', true);
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolResult('Model is read-only', true);
            }

            // Snapshot element IDs before operation using index.allIds()
            let beforeIds = new Set(modelState.index.allIds());

            const errors = [];
            const successIds = [];
            // Since we need sequential handling of the created elements, we can't call all in parallel
            for (const edge of edges) {
                const { elementTypeId, sourceElementId, targetElementId, args } = edge;

                // Validate source and target exist
                const source = modelState.index.find(sourceElementId);
                if (!source) {
                    errors.push(`Source element not found: ${sourceElementId}`);
                }

                const target = modelState.index.find(targetElementId);
                if (!target) {
                    errors.push(`Target element not found: ${targetElementId}`);
                }

                // Create operation
                const operation = CreateEdgeOperation.create({ elementTypeId, sourceElementId, targetElementId, args });

                // Dispatch operation
                await session.actionDispatcher.dispatch(operation);

                // Snapshot element IDs after operation
                const afterIds = modelState.index.allIds();

                // Find new element ID
                const newIds = afterIds.filter(id => !beforeIds.has(id));
                const newElementId = newIds.length > 0 ? newIds[0] : undefined;

                beforeIds = new Set(afterIds);

                if (!newElementId) {
                    errors.push(`Edge creation failed for input: ${JSON.stringify(edge)}`);
                    continue;
                }

                successIds.push(newElementId);
            }

            let failureStr = '';
            if (errors.length) {
                const failureListStr = errors.map(error => `- ${error}\n`);
                failureStr = `\nThe following errors occured:\n${failureListStr}`;
            }

            const successListStr = successIds.map(successId => `- ${successId}`).join('\n');
            return createToolResult(`Edge created successfully with element ID:\n${successListStr}${failureStr}`, false);
        } catch (error) {
            this.logger.error('Edge creation failed', error);
            return createToolResult(`Edge creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
