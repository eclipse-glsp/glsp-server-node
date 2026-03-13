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
import * as z from 'zod/v4';
import { GLSPMcpServer, McpIdAliasService, McpToolHandler } from '../../server';
import { createToolResult, createToolResultJson, objectArrayToMarkdownTable } from '../../util';
import { FEATURE_FLAGS } from '../../feature-flags';

/**
 * Validates the given session's model.
 */
@injectable()
export class ValidateDiagramMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'validate-diagram',
            {
                description:
                    'Validate diagram elements and return validation markers (errors, warnings, info). ' +
                    'Triggers active validation computation. Use elementIds parameter to validate specific elements, ' +
                    'or omit to validate the entire model.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID to validate'),
                    elementIds: z
                        .array(z.string())
                        .optional()
                        .describe('Array of element IDs to validate. If not provided, validates entire model starting from root.'),
                    reason: z
                        .enum([MarkersReason.BATCH, MarkersReason.LIVE])
                        .optional()
                        .default(MarkersReason.LIVE)
                        .describe('Validation reason: "batch" for thorough validation, "live" for quick incremental checks')
                },
                outputSchema: FEATURE_FLAGS.useJson
                    ? z.object({
                          markers: z
                              .array(
                                  z.object({
                                      label: z.string(),
                                      description: z.string(),
                                      elementId: z.string(),
                                      kind: z.string()
                                  })
                              )
                              .describe('List of validation results.')
                      })
                    : undefined
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        elementIds,
        reason
    }: {
        sessionId: string;
        elementIds?: string[];
        reason?: string;
    }): Promise<CallToolResult> {
        this.logger.info(`'validate-diagram' invoked for session '${sessionId}'`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }

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

        const mcpIdAliasService = session.container.get<McpIdAliasService>(McpIdAliasService);

        // Determine which elements to validate
        const idsToValidate =
            elementIds && elementIds.length > 0 ? elementIds.map(id => mcpIdAliasService.lookup(sessionId, id)) : [modelState.root.id];

        // Get elements from index
        const elements = modelState.index.getAll(idsToValidate);

        // Run validation
        const markers = (await validator.validate(elements, reason ?? MarkersReason.BATCH)).map(marker => ({
            ...marker,
            elementId: mcpIdAliasService.alias(sessionId, marker.elementId)
        }));

        if (FEATURE_FLAGS.useJson) {
            return createToolResultJson({ markers });
        }

        return createToolResult(objectArrayToMarkdownTable(markers), false);
    }
}
