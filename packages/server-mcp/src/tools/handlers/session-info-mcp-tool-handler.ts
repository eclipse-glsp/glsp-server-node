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

import { ClientSessionManager, CommandStack, ModelState } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { AbstractMcpToolHandler, McpToolError, McpToolResult } from '../../server';

export const SessionInfoInputSchema = z.object({
    sessionId: z
        .string()
        .optional()
        .describe('Optional filter — returns only the matching session, or throws if unknown. Omit to list all sessions.')
});
export type SessionInfoInput = z.infer<typeof SessionInfoInputSchema>;

export const SessionInfoRowSchema = z.object({
    sessionId: z.string(),
    diagramType: z.string(),
    sourceUri: z.string(),
    readOnly: z.boolean(),
    dirty: z.boolean().describe('True when the diagram has unsaved changes — call `save-model` to persist.')
});
export type SessionInfoRow = z.infer<typeof SessionInfoRowSchema>;

export const SessionInfoOutputSchema = z.object({
    sessions: z.array(SessionInfoRowSchema)
});

@injectable()
export class SessionInfoMcpToolHandler extends AbstractMcpToolHandler<SessionInfoInput> {
    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    static readonly NAME = 'session-info';
    readonly name = SessionInfoMcpToolHandler.NAME;
    override readonly title = 'GLSP Session Info';
    readonly description =
        'Report info on the active GLSP client sessions: session id, diagram type, source uri, and read-only status. ' +
        "Pass `sessionId` to retrieve a single session's entry; omit it to list every active session. " +
        'Useful as a discovery tool — most other diagram-scoped tools take the `sessionId` returned here.';
    readonly inputSchema = SessionInfoInputSchema;
    override readonly outputSchema = SessionInfoOutputSchema;

    protected createResult({ sessionId }: SessionInfoInput): McpToolResult {
        const sessions = sessionId !== undefined ? this.singleSession(sessionId) : this.clientSessionManager.getSessions();
        const rows = sessions.map(session => this.buildSessionRow(session));
        return this.success(this.summarizeSessions(rows), { sessions: rows });
    }

    /** Extracts a {@link SessionInfoRow} from a {@link ClientSession}. Override to surface adopter-specific fields. */
    protected buildSessionRow(session: ReturnType<ClientSessionManager['getSessions']>[number]): SessionInfoRow {
        const modelState = session.container.get<ModelState>(ModelState);
        const commandStack = session.container.get<CommandStack>(CommandStack);
        return {
            sessionId: session.id,
            diagramType: session.diagramType,
            // `ModelState.sourceUri` may be undefined for not-yet-persisted diagrams; render as empty string to keep the schema-required string shape.
            sourceUri: modelState.sourceUri ?? '',
            readOnly: modelState.isReadonly,
            dirty: commandStack.isDirty
        };
    }

    /** Builds the LLM-facing summary. Override to customize per-adopter wording. */
    protected summarizeSessions(rows: SessionInfoRow[]): string {
        if (rows.length === 0) {
            return 'No active sessions.';
        }
        const lines = rows.map(row => {
            const flags = [row.readOnly ? 'read-only' : undefined, row.dirty ? 'dirty' : undefined].filter(Boolean);
            const suffix = flags.length > 0 ? `, ${flags.join(', ')}` : '';
            return `- ${row.sessionId} (${row.diagramType}${suffix})`;
        });
        return `${rows.length} session(s); full details in structuredContent.\n${lines.join('\n')}`;
    }

    protected singleSession(sessionId: string): ReturnType<ClientSessionManager['getSessions']> {
        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            throw new McpToolError(`Unknown sessionId: ${sessionId}`);
        }
        return [session];
    }
}
