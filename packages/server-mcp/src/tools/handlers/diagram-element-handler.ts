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

import { ClientSessionManager, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpModelSerializer } from '../../resources/services/mcp-model-serializer';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates a serialized representation of a specific element of a given session's model.
 */
@injectable()
export class DiagramElementMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-element',
            {
                title: 'Diagram Model Element',
                description:
                    'Get the a single element of a GLSP model for a session as a markdown structure. ' +
                    'This is a more specific query than diagram-model.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID containing the relevant model.'),
                    elementId: z.string().describe('Element ID that should be queried.')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId, elementId }: { sessionId: string; elementId: string }): Promise<CallToolResult> {
        this.logger.info(`'diagram-element' invoked for session '${sessionId}' and element '${elementId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!elementId) {
            return createToolResult('No element id provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('No active session found for this session id.', true);
        }

        const modelState = session.container.get<ModelState>(ModelState);

        const element = modelState.index.find(elementId);
        if (!element) {
            return createToolResult('No element found for this element id.', true);
        }

        const mcpSerializer = session.container.get<McpModelSerializer>(McpModelSerializer);
        const mcpString = mcpSerializer.serialize(element);

        return createToolResult(mcpString, false);
    }
}
