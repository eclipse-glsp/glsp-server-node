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

import { ClientSessionManager, LayoutOperation, Logger } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Requests an automatic layout of a given session's diagram.
 *
 * This tool is not registered by default, since the implementation of a `LayoutEngine`
 * depends on a specific GLSP implementation and cannot be assumed to generally exist.
 * Thus, it must be registered manually if layouting is required.
 */
@injectable()
export class RequestLayoutMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'request-layout',
            {
                description:
                    "Requests an automatic layout for the given session's model. " +
                    'This should only be used if the user demands some unspecified layout. ' +
                    "In case of a custom layout, refer to the 'modify-nodes' and 'modify-edges' tools instead.",
                inputSchema: {
                    sessionId: z.string().describe('Session ID of the model to layout')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId }: { sessionId: string }): Promise<CallToolResult> {
        this.logger.info(`'request-layout' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('Session not found', true);
        }

        const operation = LayoutOperation.create();
        await session.actionDispatcher.dispatch(operation);

        return createToolResult('Automatic layout applied', false);
    }
}
