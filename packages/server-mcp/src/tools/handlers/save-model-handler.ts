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
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Saves the given session's model.
 */
@injectable()
export class SaveModelMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'save-model',
            {
                description:
                    'Save the current diagram model to persistent storage. ' +
                    'This operation persists all changes back to the source model. ' +
                    'Only do this on an explicit user request and not as part of other tasks. ' +
                    'Optionally specify a new fileUri to save to a different location.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the model should be saved'),
                    fileUri: z
                        .string()
                        .optional()
                        .describe('Optional destination file URI. If not provided, saves to the original source model location.')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId, fileUri }: { sessionId: string; fileUri?: string }): Promise<CallToolResult> {
        this.logger.info(`SaveModelMcpToolHandler invoked for session ${sessionId}`);

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
