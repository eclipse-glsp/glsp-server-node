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

import { ClientSessionManager, DeleteElementOperation, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpIdAliasService, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Deletes one or more element using their element ID from the given session's model.
 */
@injectable()
export class DeleteElementsMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'delete-elements',
            {
                description:
                    'Delete one or more elements (nodes or edges) from the diagram. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Automatically handles dependent elements (e.g., deleting a node also deletes connected edges).',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the elements should be deleted'),
                    elementIds: z.array(z.string()).min(1).describe('Array of element IDs to delete. Must include at least one element ID.')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId, elementIds }: { sessionId: string; elementIds: string[] }): Promise<CallToolResult> {
        this.logger.info(`'delete-elements' invoked for session '${sessionId}' with ${elementIds.length} elements`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!elementIds || !elementIds.length) {
            return createToolResult('No elementIds provided.', true);
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

        // Validate elements exist
        const missingIds: string[] = [];
        const realIds: string[] = [];
        for (const elementId of elementIds) {
            const realId = mcpIdAliasService.lookup(sessionId, elementId);
            const element = modelState.index.find(realId);
            if (element) {
                realIds.push(realId);
            } else {
                missingIds.push(elementId);
            }
        }

        if (missingIds.length > 0) {
            return createToolResult(`Some elements not found: ${missingIds}`, true);
        }

        // Snapshot element count before operation
        const beforeCount = modelState.index.allIds().length;

        // Create and dispatch delete operation
        const operation = DeleteElementOperation.create(realIds);
        await session.actionDispatcher.dispatch(operation);

        // Calculate how many elements were deleted (including dependents)
        const afterCount = modelState.index.allIds().length;
        const deletedCount = beforeCount - afterCount;

        return createToolResult(`Successfully deleted ${deletedCount} element(s) (including dependents)`, false);
    }
}
