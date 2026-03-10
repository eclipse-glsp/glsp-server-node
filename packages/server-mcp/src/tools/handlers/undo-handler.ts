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

import { ClientSessionManager, CommandStack, Logger, UndoAction } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Undo a given number of the most recent actions on the command stack.
 */
@injectable()
export class UndoMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'undo',
            {
                description: 'Undo a given number of the last executed commands in the diagram and reverts their changes.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where undo should be performed'),
                    commandsToUndo: z.number().min(1).describe('Number of commands to undo')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId, commandsToUndo }: { sessionId: string; commandsToUndo: number }): Promise<CallToolResult> {
        this.logger.info(`'undo' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('Session not found', true);
        }

        const commandStack = session.container.get<CommandStack>(CommandStack);

        if (!commandStack.canUndo()) {
            return createToolResult('Nothing to undo', true);
        }

        for (let i = 0; i < commandsToUndo; i++) {
            const action = UndoAction.create();
            await session.actionDispatcher.dispatch(action);
        }

        return createToolResult('Undo successful', false);
    }
}
