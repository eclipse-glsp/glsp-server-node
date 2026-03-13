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
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpResourceHandler, ResourceHandlerResult } from '../../server';
import { createResourceResult, createResourceToolResult, extractResourceParam } from '../../util';
import { McpModelSerializer } from '../services/mcp-model-serializer';
import { FEATURE_FLAGS } from '../../feature-flags';

/**
 * Creates a serialized representation of a given session's model state.
 */
@injectable()
export class DiagramModelMcpResourceHandler implements McpResourceHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-model',
            new ResourceTemplate('glsp://diagrams/{sessionId}/model', {
                list: () => {
                    const sessionIds = this.getSessionIds();
                    return {
                        resources: sessionIds.map(sessionId => ({
                            uri: `glsp://diagrams/${sessionId}/model`,
                            name: `Diagram Model: ${sessionId}`,
                            description: `Complete GLSP model structure for session ${sessionId}`,
                            mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown'
                        }))
                    };
                },
                complete: {
                    sessionId: () => this.getSessionIds()
                }
            }),
            {
                title: 'Diagram Model Structure',
                description:
                    'Get the complete GLSP model for a session as a markdown structure. ' +
                    'Includes all nodes, edges, and their relevant properties.',
                mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown'
            },
            async (_uri, params) => createResourceResult(await this.handle({ sessionId: extractResourceParam(params, 'sessionId') }))
        );
    }

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-model',
            {
                title: 'Diagram Model Structure',
                description:
                    'Get the complete GLSP model for a session as a markdown structure. ' +
                    'Includes all nodes, edges, and their relevant properties.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID for which to query the model.')
                },
                outputSchema: FEATURE_FLAGS.useJson
                    ? z.object().describe('Dictionary of diagram element type to a list of elements.')
                    : undefined
            },
            async params => createResourceToolResult(await this.handle(params))
        );
    }

    async handle({ sessionId }: { sessionId?: string }): Promise<ResourceHandlerResult> {
        this.logger.info(`'diagram-model' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return {
                content: {
                    uri: `glsp://diagrams/${sessionId}/model`,
                    mimeType: 'text/plain',
                    text: 'No session id provided.'
                },
                isError: true
            };
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return {
                content: {
                    uri: `glsp://diagrams/${sessionId}/model`,
                    mimeType: 'text/plain',
                    text: 'No active session found for this session id.'
                },
                isError: true
            };
        }

        const modelState = session.container.get<ModelState>(ModelState);
        const mcpSerializer = session.container.get<McpModelSerializer>(McpModelSerializer);
        const [mcpString, flattenedGraph] = mcpSerializer.serialize(modelState.root);

        return {
            content: {
                uri: `glsp://diagrams/${sessionId}/model`,
                mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown',
                text: mcpString
            },
            isError: false,
            data: flattenedGraph
        };
    }

    protected getSessionIds(): string[] {
        return this.clientSessionManager.getSessions().map(s => s.id);
    }
}
