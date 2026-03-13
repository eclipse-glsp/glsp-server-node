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

import {
    Action,
    ActionHandler,
    ClientSessionManager,
    GetSelectionMcpAction,
    GetSelectionMcpResultAction,
    Logger
} from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpIdAliasService, McpToolHandler } from '../../server';
import { createToolResult, createToolResultJson } from '../../util';
import { FEATURE_FLAGS } from '../../feature-flags';

/**
 * Queries the currently selected elements for a given session's diagram.
 */
@injectable()
export class GetSelectionMcpToolHandler implements McpToolHandler, ActionHandler {
    actionKinds = [GetSelectionMcpResultAction.KIND];

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    protected resolvers: Record<string, { sessionId: string; resolve: (value: CallToolResult | PromiseLike<CallToolResult>) => void }> = {};

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'get-selection',
            {
                title: 'Get Selected Diagram Elements',
                description:
                    'Get the element IDs of all currently selected elements in the UI. ' +
                    'This is usually only relevant when a user directly references their selection.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID for which the selection should be queried')
                },
                outputSchema: z.object({
                    selectedIds: z.array(z.string()).describe('IDs of the selected diagram elements')
                })
            },
            params => this.handle(params)
        );
    }

    async handle({ sessionId }: { sessionId?: string }): Promise<CallToolResult> {
        this.logger.info(`'get-selection' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('No active session found for this session id.', true);
        }

        const requestId = Math.trunc(Math.random() * 1000).toString();
        this.logger.info(`GetSelectionMcpAction dispatched with request ID '${requestId}'`);
        session.actionDispatcher.dispatch(GetSelectionMcpAction.create(requestId));

        // Start a promise and save the resolve function to the class
        return new Promise(resolve => {
            this.resolvers[requestId] = { sessionId, resolve };
            setTimeout(() => resolve(createToolResult('The request timed out.', true)), 5000);
        });
    }

    async execute(action: GetSelectionMcpResultAction): Promise<Action[]> {
        const requestId = action.mcpRequestId;
        this.logger.info(`GetSelectionMcpResultAction received with request ID '${requestId}'`);

        const { sessionId, resolve } = this.resolvers[requestId];

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            this.logger.warn(`No session '${sessionId}' for request ID '${requestId}'`);
            return [];
        }

        const mcpIdAliasService = session.container.get<McpIdAliasService>(McpIdAliasService);

        const selectedIds = action.selectedElementsIDs.map(id => mcpIdAliasService.alias(sessionId, id));

        if (FEATURE_FLAGS.useJson) {
            resolve?.(createToolResultJson({ selectedIds }));
        } else {
            // Resolve the previously started promise
            const selectedIdsStr = selectedIds.map(id => `- ${id}`).join('\n');
            resolve?.(createToolResult(`Following element IDs are selected:\n${selectedIdsStr}`, false));
        }

        delete this.resolvers[requestId];

        return [];
    }
}
