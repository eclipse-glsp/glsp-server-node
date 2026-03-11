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

import { Action, CenterAction, ClientSessionManager, FitToScreenAction, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Changes the given session's viewport.
 */
@injectable()
export class ChangeViewMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    protected viewportActions: string[] = ['fit-to-screen', 'center-on-elements', 'reset-viewport'];

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'change-view',
            {
                description: "Change the viewport of the session's associated UI. " + 'This is only relevent on explicit user request.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the model should be saved'),
                    viewportAction: z.enum(this.viewportActions).describe('The type of viewport change action to be undertaken.'),
                    elementIds: z
                        .array(z.string())
                        .optional()
                        .describe(
                            "Elements to center on or fit. Relevant for actions 'center-on-elements' and 'fit-to-screen'. " +
                                'If omitted, the entire diagram is taken instead.'
                        )
                }
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        viewportAction,
        elementIds
    }: {
        sessionId: string;
        viewportAction: string;
        elementIds?: string[];
    }): Promise<CallToolResult> {
        this.logger.info(`'change-view' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('Session not found', true);
        }

        if (!elementIds) {
            const modelState = session.container.get<ModelState>(ModelState);
            elementIds = modelState.index.allIds();
        }

        let action: Action | undefined = undefined;
        switch (viewportAction) {
            case 'fit-to-screen':
                action = FitToScreenAction.create(elementIds, { animate: true, padding: 20 });
                break;
            case 'center-on-elements':
                action = CenterAction.create(elementIds, { animate: true, retainZoom: true });
                break;
            case 'reset-viewport':
                // TODO `OriginViewportAction` is not available, because it lives in feature space, not protocol space
                // TODO should this be removed?
                action = { kind: 'originViewport', animate: true } as Action;
                break;
        }

        if (!action) {
            return createToolResult('Invalid viewport action', true);
        }

        await session.actionDispatcher.dispatch(action);

        return createToolResult('Viewport successfully changed', false);
    }
}
