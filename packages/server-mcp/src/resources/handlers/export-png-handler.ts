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
    ActionDispatcher,
    ActionHandler,
    ClientSessionManager,
    ExportMcpPngAction,
    Logger,
    RequestExportMcpPngAction
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { ResourceHandlerResult } from '../../server';

export const McpResourcePngHandler = Symbol('McpResourcePngHandler');

/**
 * The `McpResourcePngHandler` provides a handler function to produce a PNG of the current model.
 */
export interface McpResourcePngHandler {
    /**
     * Creates a base64-encoded PNG of the given session's model state.
     * @param sessionId The relevant session.
     */
    getModelPng(sessionId: string | undefined): Promise<ResourceHandlerResult>;
}

/**
 * Since visual logic is not only much easier on the frontend, but also already implemented there
 * with little reason to engineer the feature on the backend, communication with the frontend is necessary.
 * However, GLSP's architecture is client-driven, i.e., the server is passive and not the driver of events.
 * This means that we have to somewhat circumvent this by making this handler simultaneously an `ActionHandler`.
 *
 * We trigger the frontend PNG creation using {@link RequestExportMcpPngAction} and register this class as an
 * `ActionHandler` for the response action {@link ExportMcpPngAction}. This is necessary, because we can't just
 * wait for the result of a dispatched action (at least on the server side). Instead, we make use of the class
 * to carry the promise resolver for the initial request (by the MCP client) to use when receiving the response action.
 * However, it is unclear whether this works in all circumstances, as it introduces impure functions.
 */
@injectable()
export class DefaultMcpResourcePngHandler implements McpResourcePngHandler, ActionHandler {
    actionKinds = [ExportMcpPngAction.KIND];

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    protected promiseResolveFn: (value: ResourceHandlerResult | PromiseLike<ResourceHandlerResult>) => void;

    async execute(action: ExportMcpPngAction): Promise<Action[]> {
        const sessionId = action.options?.sessionId ?? '';
        this.logger.info(`ExportMcpPngAction received for session ${sessionId}`);

        this.promiseResolveFn?.({
            content: {
                uri: `glsp://diagrams/${sessionId}/png`,
                mimeType: 'image/png',
                blob: action.png
            },
            isError: false
        });

        return [];
    }

    async getModelPng(sessionId: string | undefined): Promise<ResourceHandlerResult> {
        this.logger.info(`getModelPng invoked for session ${sessionId}`);
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

        const actionDispatcher = session.container.get<ActionDispatcher>(ActionDispatcher);

        actionDispatcher.dispatch(RequestExportMcpPngAction.create({ options: { sessionId } }));

        return new Promise(resolve => {
            this.promiseResolveFn = resolve;
            setTimeout(
                () =>
                    resolve({
                        content: {
                            uri: `glsp://diagrams/${sessionId}/png`,
                            mimeType: 'text/plain',
                            text: 'The generation of the PNG timed out.'
                        },
                        isError: true
                    }),
                5000
            );
        });
    }
}
