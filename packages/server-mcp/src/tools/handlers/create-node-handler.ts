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

import { ClientSessionManager, CreateNodeOperation, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates a new node in the given session's model.
 */
@injectable()
export class CreateNodeMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-node',
            {
                description:
                    'Create a new node element in the diagram at a specified location. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Query glsp://types/{diagramType}/elements resource to discover valid element type IDs.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the node should be created'),
                    elementTypeId: z
                        .string()
                        .describe(
                            'Element type ID (e.g., "task:manual", "task:automated"). ' +
                                'Use element-types resource to discover valid IDs.'
                        ),
                    location: z
                        .object({
                            x: z.number().describe('X coordinate in diagram space'),
                            y: z.number().describe('Y coordinate in diagram space')
                        })
                        .describe('Position where the node should be created (absolute diagram coordinates)'),
                    containerId: z.string().optional().describe('ID of the container element. If not provided, node is added to the root.'),
                    args: z
                        .record(z.string(), z.any())
                        .optional()
                        .describe('Additional type-specific arguments for node creation (varies by element type)')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        elementTypeId,
        location,
        containerId,
        args
    }: {
        sessionId: string;
        elementTypeId: string;
        location: { x: number; y: number };
        containerId?: string;
        args?: Record<string, any>;
    }): Promise<CallToolResult> {
        this.logger.info(`CreateNodeMcpToolHandler invoked for session ${sessionId}`);

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
            const beforeIds = new Set(modelState.index.allIds());

            // Create operation
            const operation = CreateNodeOperation.create(elementTypeId, { location, containerId, args });

            // Dispatch operation
            await session.actionDispatcher.dispatch(operation);

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID
            const newIds = afterIds.filter(id => !beforeIds.has(id));
            const newElementId = newIds.length > 0 ? newIds[0] : undefined;

            if (!newElementId) {
                return createToolResult('Node creation succeeded but could not determine element ID', true);
            }

            return createToolResult(`Node created successfully with element ID: ${newElementId}`, false);
        } catch (error) {
            this.logger.error('Node creation failed', error);
            return createToolResult(`Node creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
