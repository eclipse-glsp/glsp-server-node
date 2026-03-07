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

import { ClientSessionManager, Logger, MarkersReason, ModelState, ModelValidator } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import { createToolResult, objectArrayToMarkdownTable } from '../../util';

export const McpToolValidationHandler = Symbol('McpToolValidationHandler');

/**
 * The `McpToolValidationHandler`
 */
export interface McpToolValidationHandler {
    validateDiagram(params: { sessionId: string; elementIds?: string[]; reason?: string }): Promise<CallToolResult>;
}

@injectable()
export class DefaultMcpToolValidationHandler implements McpToolValidationHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    async validateDiagram({
        sessionId,
        elementIds,
        reason
    }: {
        sessionId: string;
        elementIds?: string[];
        reason?: string;
    }): Promise<CallToolResult> {
        this.logger.info(`validateDiagram invoked for session ${sessionId}`);

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolResult('Session not found', true);
            }

            const modelState = session.container.get<ModelState>(ModelState);

            let validator: ModelValidator;
            try {
                validator = session.container.get<ModelValidator>(ModelValidator);
            } catch (error) {
                return createToolResult('No validator configured for this diagram type', true);
            }

            // Determine which elements to validate
            const idsToValidate = elementIds && elementIds.length > 0 ? elementIds : [modelState.root.id];

            // Get elements from index
            const elements = modelState.index.getAll(idsToValidate);

            // Run validation
            const markers = await validator.validate(elements, reason ?? MarkersReason.BATCH);

            return createToolResult(objectArrayToMarkdownTable(markers), false);
        } catch (error) {
            this.logger.error('Validation failed', error);
            return createToolResult(`Validation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
