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

import { Action, ActionHandler, ClientSessionManager, ExportPngMcpAction, ExportPngMcpActionResult, Logger } from '@eclipse-glsp/server';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpOptionService, McpResourceHandler, ResourceHandlerResult } from '../../server';
import { createResourceResult, createToolResult, extractResourceParam } from '../../util';
import * as uuid from 'uuid';

/**
 * Creates a base64-encoded PNG of the given session's model state.
 *
 * Since visual logic is not only much easier on the frontend, but also already implemented there
 * with little reason to engineer the feature on the backend, communication with the frontend is necessary.
 * However, GLSP's architecture is client-driven, i.e., the server is passive and not the driver of events.
 * This means that we have to somewhat circumvent this by making this handler simultaneously an `ActionHandler`.
 *
 * We trigger the frontend PNG creation using {@link ExportPngMcpAction} and register this class as an
 * `ActionHandler` for the response action {@link ExportPngMcpActionResult}. This is necessary, because we can't just
 * wait for the result of a dispatched action (at least on the server side). Instead, we make use of the class
 * to carry the promise resolver for the initial request (by the MCP client) to use when receiving the response action.
 * However, it is unclear whether this works in all circumstances, as it introduces impure functions.
 */
@injectable()
export class DiagramPngMcpResourceHandler implements McpResourceHandler, ActionHandler {
    actionKinds = [ExportPngMcpActionResult.KIND];

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    @inject(McpOptionService)
    protected mcpOptionService: McpOptionService;

    protected resolvers: Record<
        string,
        { sessionId: string; resolve: (value: ResourceHandlerResult | PromiseLike<ResourceHandlerResult>) => void }
    > = {};

    registerResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-png',
            new ResourceTemplate('glsp://diagrams/{sessionId}/png', {
                list: () => {
                    const sessionIds = this.getSessionIds();
                    return {
                        resources: sessionIds.map(sessionId => ({
                            uri: `glsp://diagrams/${sessionId}/png`,
                            name: `Diagram PNG: ${sessionId}`,
                            description: `Complete PNG of the model for session ${sessionId}`,
                            mimeType: 'image/png'
                        }))
                    };
                },
                complete: {
                    sessionId: () => this.getSessionIds()
                }
            }),
            {
                title: 'Diagram Model PNG',
                description:
                    'Get the complete image of the model for a session as a PNG. ' +
                    'Includes all nodes and edges to help with visually relevant tasks.',
                mimeType: 'image/png'
            },
            async (_uri, params) => createResourceResult(await this.handle({ sessionId: extractResourceParam(params, 'sessionId') }))
        );
    }

    registerToolAlternative(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-png',
            {
                title: 'Diagram Model PNG',
                description:
                    'Get the complete image of the model for a session as a PNG. ' +
                    'Includes all nodes and edges to help with visually relevant tasks.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID for which the image should be created')
                }
            },
            async params => {
                const result = await this.handle(params);
                if (result.isError) {
                    return createToolResult((result.content as any).text, true);
                }

                return {
                    isError: result.isError,
                    content: [
                        {
                            type: 'image',
                            data: (result.content as any).blob,
                            mimeType: 'image/png'
                        }
                    ]
                };
            }
        );
    }

    async handle({ sessionId }: { sessionId?: string }): Promise<ResourceHandlerResult> {
        this.logger.info(`'diagram-png' invoked for session ${sessionId}`);

        if (!sessionId) {
            return {
                content: {
                    uri: `glsp://diagrams/${sessionId}/png`,
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
                    uri: `glsp://diagrams/${sessionId}/png`,
                    mimeType: 'text/plain',
                    text: 'No active session found for this session id.'
                },
                isError: true
            };
        }

        const requestId = uuid.v4();
        this.logger.info(`ExportPngMcpAction dispatched with request ID '${requestId}'`);
        session.actionDispatcher.dispatch(ExportPngMcpAction.create(requestId));

        const timeout = this.mcpOptionService.get('exportPngTimeout') ?? 5000;
        // Start a promise and save the resolve function to the class
        return new Promise(resolve => {
            this.resolvers[requestId] = { sessionId, resolve };
            setTimeout(() => {
                delete this.resolvers[requestId];
                resolve({
                    content: {
                        uri: `glsp://diagrams/${sessionId}/png`,
                        mimeType: 'text/plain',
                        text: 'The generation of the PNG timed out.'
                    },
                    isError: true
                });
            }, timeout);
        });
    }

    async execute(action: ExportPngMcpActionResult): Promise<Action[]> {
        const requestId = action.mcpRequestId;
        this.logger.info(`ExportPngMcpActionResult received with request ID '${requestId}'`);

        // Resolve the previously started promise
        const { sessionId, resolve } = this.resolvers[requestId];
        resolve?.({
            content: {
                uri: `glsp://diagrams/${sessionId}/png`,
                mimeType: 'image/png',
                blob: action.png
            },
            isError: false
        });
        delete this.resolvers[requestId];

        return [];
    }

    protected getSessionIds(): string[] {
        return this.clientSessionManager.getSessions().map(s => s.id);
    }
}
