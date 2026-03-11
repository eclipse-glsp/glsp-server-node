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

import { ClientSessionManager, GModelElement, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpModelSerializer } from '../../resources/services/mcp-model-serializer';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates a serialized representation of one or more specific elements of a given session's model.
 */
@injectable()
export class DiagramElementsMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-elements',
            {
                title: 'Diagram Model Elements',
                description:
                    'Get one or more elements of a GLSP model for a session as a markdown structure. ' +
                    'This is a more specific query than diagram-model to use if not the entire model is relevant.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID containing the relevant model.'),
                    elementIds: z.array(z.string()).min(1).describe('Element IDs that should be queried.')
                }
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId, elementIds }: { sessionId: string; elementIds: string[] }): Promise<CallToolResult> {
        this.logger.info(`'diagram-element' invoked for session '${sessionId}' and '${elementIds.length}' elements`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!elementIds || !elementIds.length) {
            return createToolResult('No element ids provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('No active session found for this session id.', true);
        }

        const modelState = session.container.get<ModelState>(ModelState);

        const elements: GModelElement[] = [];
        for (const elementId of elementIds) {
            const element = modelState.index.find(elementId);
            if (!element) {
                return createToolResult('No element found for this element id.', true);
            }
            elements.push(element);
        }

        const mcpSerializer = session.container.get<McpModelSerializer>(McpModelSerializer);
        const mcpString = mcpSerializer.serializeArray(elements);

        return createToolResult(mcpString, false);
    }
}
