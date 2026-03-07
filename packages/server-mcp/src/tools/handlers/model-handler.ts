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

import { ClientSessionManager, CommandStack, Logger, SaveModelAction } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import { createToolResult } from '../../util';

export const McpToolModelHandler = Symbol('McpToolModelHandler');

/**
 * The `McpToolModelHandler`
 */
export interface McpToolModelHandler {
    saveModel(params: { sessionId: string; fileUri?: string }): Promise<CallToolResult>;
}

@injectable()
export class DefaultMcpToolModelHandler implements McpToolModelHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    async saveModel({ sessionId, fileUri }: { sessionId: string; fileUri?: string }): Promise<CallToolResult> {
        this.logger.info(`saveModel invoked for session ${sessionId}`);

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolResult('Session not found', true);
            }

            const commandStack = session.container.get<CommandStack>(CommandStack);

            // Check if there are unsaved changes
            if (!commandStack.isDirty) {
                return createToolResult('No changes to save', false);
            }

            // Dispatch save action
            const action = SaveModelAction.create({ fileUri });
            await session.actionDispatcher.dispatch(action);

            return createToolResult('Model saved successfully', false);
        } catch (error) {
            this.logger.error('Save failed', error);
            return createToolResult(`Save failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
