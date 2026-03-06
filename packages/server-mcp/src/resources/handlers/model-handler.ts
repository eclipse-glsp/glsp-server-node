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
import { inject, injectable } from 'inversify';
import { ResourceHandlerResult } from '../../server';
import { McpModelSerializer } from '../services/mcp-model-serializer';

export const McpResourceModelHandler = Symbol('McpResourceModelHandler');

/**
 * The `McpResourceModelHandler` provides information about a specific model.
 */
export interface McpResourceModelHandler {
    /**
     * Creates a serialized representation of the given session's model state.
     * @param sessionId The relevant session.
     */
    getDiagramModel(sessionId: string | undefined): ResourceHandlerResult;
}

@injectable()
export class DefaultMcpResourceModelHandler implements McpResourceModelHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    getDiagramModel(sessionId: string | undefined): ResourceHandlerResult {
        this.logger.info(`getDiagramModel invoked for session ${sessionId}`);
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
        const mcpString = mcpSerializer.serialize(modelState.root);

        return {
            content: {
                uri: `glsp://diagrams/${sessionId}/model`,
                mimeType: 'text/markdown',
                text: mcpString
            },
            isError: false
        };
    }
}
