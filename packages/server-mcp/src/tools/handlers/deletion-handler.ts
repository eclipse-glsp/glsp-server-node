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
import { createToolResult } from '../../util';

export const McpToolDeletionHandler = Symbol('McpToolDeletionHandler');

/**
 * The `McpToolDeletionHandler`
 */
export interface McpToolDeletionHandler {
    deleteElement(params: { sessionId: string; elementIds: string[] }): Promise<CallToolResult>;
}

@injectable()
export class DefaultMcpToolDeletionHandler implements McpToolDeletionHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    async deleteElement({ sessionId, elementIds }: { sessionId: string; elementIds: string[] }): Promise<CallToolResult> {
        this.logger.info(`deleteElement invoked for session ${sessionId}`);

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

            // Validate elements exist
            const missingIds: string[] = [];
            for (const elementId of elementIds) {
                const element = modelState.index.find(elementId);
                if (!element) {
                    missingIds.push(elementId);
                }
            }

            if (missingIds.length > 0) {
                return createToolResult(`Some elements not found: ${missingIds}`, true);
            }

            // Snapshot element count before operation
            const beforeCount = modelState.index.allIds().length;

            // Create and dispatch delete operation
            const operation = DeleteElementOperation.create(elementIds);
            await session.actionDispatcher.dispatch(operation);

            // Calculate how many elements were deleted (including dependents)
            const afterCount = modelState.index.allIds().length;
            const deletedCount = beforeCount - afterCount;

            return createToolResult(`Successfully deleted ${deletedCount} element(s) (including dependents)`, false);
        } catch (error) {
            this.logger.error('Element deletion failed', error);
            return createToolResult(`Element deletion failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
