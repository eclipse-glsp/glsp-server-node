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
                    elementTypeId: z
                        .string()
                        .describe('Edge type ID (e.g., "edge", "transition"). Use element-types resource to discover valid IDs.'),
                    sourceElementId: z.string().describe('ID of the source element (must exist in the diagram)'),
                    targetElementId: z.string().describe('ID of the target element (must exist in the diagram)'),
                    args: z
                        .record(z.string(), z.any())
                        .optional()
                        .describe('Additional type-specific arguments for edge creation (varies by edge type)')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        elementTypeId,
        sourceElementId,
        targetElementId,
        args
    }: {
        sessionId: string;
        elementTypeId: string;
        sourceElementId: string;
        targetElementId: string;
        args?: Record<string, any>;
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

            // Validate source and target exist
            const source = modelState.index.find(sourceElementId);
            if (!source) {
                return createToolResult(`Source element not found: ${sourceElementId}`, true);
            }

            const target = modelState.index.find(targetElementId);
            if (!target) {
                return createToolResult(`Target element not found: ${targetElementId}`, true);
            }

            // Snapshot element IDs before operation using index.allIds()
            const beforeIds = new Set(modelState.index.allIds());

            // Create operation
            const operation = CreateEdgeOperation.create({ elementTypeId, sourceElementId, targetElementId, args });

            // Dispatch operation
            await session.actionDispatcher.dispatch(operation);

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID
            const newIds = afterIds.filter(id => !beforeIds.has(id));
            const newElementId = newIds.length > 0 ? newIds[0] : undefined;

            if (!newElementId) {
                return createToolResult('Edge creation succeeded but could not determine element ID', true);
            }

            return createToolResult(`Edge created successfully with element ID: ${newElementId}`, false);
        } catch (error) {
            this.logger.error('Edge creation failed', error);
            return createToolResult(`Edge creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
