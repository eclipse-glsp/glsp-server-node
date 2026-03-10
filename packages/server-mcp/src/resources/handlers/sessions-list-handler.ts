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
import { GLSPMcpServer, McpResourceHandler, ResourceHandlerResult } from '../../server';
import { createResourceResult, createResourceToolResult, objectArrayToMarkdownTable } from '../../util';

/**
 * Lists the current sessions according to the {@link ClientSessionManager}. This includes not only
 * their id but also diagram type, source uri, and read-only status.
 */
@injectable()
export class SessionsListMcpResourceHandler implements McpResourceHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerResource(server: GLSPMcpServer): void {
        server.registerResource(
            'sessions-list',
            'glsp://sessions',
            {
                title: 'GLSP Sessions List',
                description: 'List all active GLSP client sessions across all diagram types',
                mimeType: 'text/markdown'
            },
            async () => createResourceResult(await this.handle({}))
        );
    }

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'sessions-list',
            {
                title: 'GLSP Sessions List',
                description: 'List all active GLSP client sessions across all diagram types'
            },
            async () => createResourceToolResult(await this.handle({}))
        );
    }

    async handle(params: Record<string, never>): Promise<ResourceHandlerResult> {
        this.logger.info("'sessions-list' invoked");

        const sessions = this.clientSessionManager.getSessions();
        const sessionsList = sessions.map(session => {
            const modelState = session.container.get<ModelState>(ModelState);
            return {
                sessionId: session.id,
                diagramType: session.diagramType,
                sourceUri: modelState.sourceUri,
                readOnly: modelState.isReadonly
            };
        });

        return {
            content: {
                uri: 'glsp://sessions',
                mimeType: 'text/markdown',
                text: objectArrayToMarkdownTable(sessionsList)
            },
            isError: false
        };
    }
}
