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
import { objectArrayToMarkdownTable } from '../../util';

export const McpResourceSessionHandler = Symbol('McpResourceSessionHandler');

/**
 * The `McpResourceSessionHandler` provides information about the sessions currently active.
 */
export interface McpResourceSessionHandler {
    /**
     * Lists the current session ids according to the {@link ClientSessionManager}.
     */
    getSessionIds(): string[];

    /**
     * Lists the current sessions according to the {@link ClientSessionManager}. This includes not only
     * their id but also diagram type, source uri, and read-only status.
     */
    getAllSessions(): ResourceHandlerResult;
}

@injectable()
export class DefaultMcpResourceSessionHandler implements McpResourceSessionHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    getSessionIds(): string[] {
        return this.clientSessionManager.getSessions().map(s => s.id);
    }

    getAllSessions(): ResourceHandlerResult {
        this.logger.info('getAllSessions invoked');
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
