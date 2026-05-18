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

import { ClientSessionManager } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpPromptResult, resolveActiveSessionId } from '../../server/mcp-handler-shared';
import { AbstractMcpPromptHandler } from '../../server/mcp-prompt-handler';
import { DiagramModelMcpToolHandler } from '../../tools/handlers/diagram-model-mcp-tool-handler';
import { QueryElementsMcpToolHandler } from '../../tools/handlers/query-elements-mcp-tool-handler';
import { SetSelectionMcpToolHandler } from '../../tools/handlers/set-selection-mcp-tool-handler';
import { ValidateDiagramMcpToolHandler } from '../../tools/handlers/validate-diagram-mcp-tool-handler';

export const SuggestImprovementsArgsSchema = z.object({
    sessionId: z
        .string()
        .optional()
        .describe('GLSP client session id (open diagram). Defaults to the only open session; required when multiple are open.')
});
export type SuggestImprovementsArgs = z.infer<typeof SuggestImprovementsArgsSchema>;

/**
 * Prompt template that asks the agent to review the diagram and propose concrete improvements
 * (validation issues, structural smells, missing labels, etc.). The agent orchestrates the
 * tool calls; this prompt only frames the task.
 *
 * Server-scope on purpose — the prompt itself has no per-session state, so we avoid forcing
 * the user to type a sessionId in the common single-diagram case.
 */
@injectable()
export class SuggestImprovementsMcpPromptHandler extends AbstractMcpPromptHandler<SuggestImprovementsArgs> {
    static readonly NAME = 'suggest-improvements';
    readonly name = SuggestImprovementsMcpPromptHandler.NAME;
    override readonly title = 'Suggest Diagram Improvements';
    readonly description =
        'Review an open diagram and propose concrete improvements grouped by severity ' +
        '(must-fix vs. nice-to-have). The agent runs validation, checks connectivity, looks for unclear labels, ' +
        'and flags structural inconsistencies, then names the specific element ids for each suggestion so the user ' +
        'can act on them. Read-only by intent — the prompt instructs the agent not to modify the diagram, only propose. ' +
        '`sessionId` is optional — defaults to the only open session.';
    readonly argsSchema = SuggestImprovementsArgsSchema;

    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    override referencedToolNames(): string[] {
        return [
            ValidateDiagramMcpToolHandler.NAME,
            DiagramModelMcpToolHandler.NAME,
            QueryElementsMcpToolHandler.NAME,
            SetSelectionMcpToolHandler.NAME
        ];
    }

    protected createResult(args: SuggestImprovementsArgs): McpPromptResult {
        const sessionId = resolveActiveSessionId(this.clientSessionManager, args.sessionId);
        const text =
            `Review the diagram for session \`${sessionId}\` and propose concrete improvements. Focus on:\n\n` +
            `1. **Validation issues** — run \`${ValidateDiagramMcpToolHandler.NAME}\` and surface any markers.\n` +
            `2. **Connectivity** — load the model (\`${DiagramModelMcpToolHandler.NAME}\`) and flag unconnected ` +
            `nodes or orphaned subgraphs.\n` +
            `3. **Labelling** — use \`${QueryElementsMcpToolHandler.NAME}\` to find nodes that lack a meaningful ` +
            `label, and edges with missing or unclear text.\n` +
            `4. **Structure** — call out elements whose type or placement looks inconsistent with ` +
            `the rest of the diagram.\n\n` +
            `Group findings by severity (must-fix vs. nice-to-have). ` +
            `When naming elements, prefer their label or type with the alias in parens — e.g. ` +
            `"the 'Brew' task (#7)" or "the decision node (#9)" — never the bare alias alone, since aliases mean nothing to the user. ` +
            `Point at each suggestion via \`${SetSelectionMcpToolHandler.NAME}\` so the user can navigate. ` +
            `Do not modify the diagram — only propose.`;
        return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    }
}
