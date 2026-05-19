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
import { CountElementsMcpToolHandler } from '../../tools/handlers/count-elements-mcp-tool-handler';
import { DiagramModelMcpToolHandler } from '../../tools/handlers/diagram-model-mcp-tool-handler';
import { ElementTypesMcpToolHandler } from '../../tools/handlers/element-types-mcp-tool-handler';
import { QueryElementsMcpToolHandler } from '../../tools/handlers/query-elements-mcp-tool-handler';
import { SetSelectionMcpToolHandler } from '../../tools/handlers/set-selection-mcp-tool-handler';
import { SetViewMcpToolHandler } from '../../tools/handlers/set-view-mcp-tool-handler';

export const DescribeDiagramArgsSchema = z.object({
    sessionId: z
        .string()
        .optional()
        .describe('GLSP client session id (open diagram). Defaults to the only open session; required when multiple are open.')
});
export type DescribeDiagramArgs = z.infer<typeof DescribeDiagramArgsSchema>;

/**
 * Prompt template that instructs the agent to produce a structured description of a diagram.
 * Pre-baked starting point invokable from the MCP-client UI; the agent then orchestrates the
 * necessary tool calls on its own.
 *
 * Server-scope on purpose — the prompt itself has no per-session state, so we avoid forcing
 * the user to type a sessionId in the common single-diagram case.
 */
@injectable()
export class DescribeDiagramMcpPromptHandler extends AbstractMcpPromptHandler<DescribeDiagramArgs> {
    static readonly NAME = 'describe-diagram';
    readonly name = DescribeDiagramMcpPromptHandler.NAME;
    override readonly title = 'Describe Diagram';
    readonly description =
        'Produce a structured, skim-friendly description of an open diagram. ' +
        'The agent picks the right tools to gather data (overview, element-type breakdown, structure, notable elements) ' +
        'and writes the description in its own words. ' +
        'Use this as a starting point when the user asks "what does this diagram show?" or wants a documentation-style summary. ' +
        '`sessionId` is optional — defaults to the only open session.';
    readonly argsSchema = DescribeDiagramArgsSchema;

    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    override referencedToolNames(): string[] {
        return [
            CountElementsMcpToolHandler.NAME,
            ElementTypesMcpToolHandler.NAME,
            DiagramModelMcpToolHandler.NAME,
            QueryElementsMcpToolHandler.NAME,
            SetSelectionMcpToolHandler.NAME,
            SetViewMcpToolHandler.NAME
        ];
    }

    protected createResult(args: DescribeDiagramArgs): McpPromptResult {
        const sessionId = resolveActiveSessionId(this.clientSessionManager, args.sessionId);
        const text =
            `Describe the diagram for session \`${sessionId}\`. Include:\n\n` +
            `1. **Overview** — diagram type and total element count (use \`${CountElementsMcpToolHandler.NAME}\`).\n` +
            `2. **Element-type breakdown** — what kinds of elements are present and how many of each ` +
            `(use \`${ElementTypesMcpToolHandler.NAME}\` and \`${CountElementsMcpToolHandler.NAME}\`).\n` +
            `3. **Structure** — load the model with \`${DiagramModelMcpToolHandler.NAME}\` and summarize the ` +
            `hierarchy and major connections.\n` +
            `4. **Notable elements** — call out anything that stands out (unconnected nodes, deeply ` +
            `nested groups, missing labels). Use \`${QueryElementsMcpToolHandler.NAME}\` to locate specific cases.\n\n` +
            `Keep the description concise and skim-friendly. ` +
            `When mentioning an element, prefer its label or type, with the alias appended in parens — e.g. ` +
            `"the 'Brew' task (#7)" or "the decision node (#9)" — never the bare alias alone, since aliases mean nothing to the user. ` +
            `Use \`${SetSelectionMcpToolHandler.NAME}\` or \`${SetViewMcpToolHandler.NAME} → 'center-on-elements'\` to draw the user's attention.`;
        return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    }
}
