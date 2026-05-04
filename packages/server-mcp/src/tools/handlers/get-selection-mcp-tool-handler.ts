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

import { ActionDispatcher, GetSelectionAction } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpDiagramScopedInputSchema, AbstractMcpDiagramToolHandler, McpToolResult, requestActionOrFail } from '../../server';

export const GetSelectionInputSchema = McpDiagramScopedInputSchema;
export type GetSelectionInput = z.infer<typeof GetSelectionInputSchema>;

export const GetSelectionOutputSchema = z.object({
    selectedElementIds: z.array(z.string()).describe('Aliased ids of the elements currently selected on the client.')
});

/** Round-trips a sprotty {@link GetSelectionAction} via `ActionDispatcher.requestUntil` and awaits the matching `SelectionResult`. */
@injectable()
export class GetSelectionMcpToolHandler extends AbstractMcpDiagramToolHandler<GetSelectionInput> {
    /** Timeout (in ms) for awaiting the selection response from the client. Override via subclass + rebind. */
    protected readonly timeoutMs: number = 5000;

    static readonly NAME = 'get-selection';
    readonly name = GetSelectionMcpToolHandler.NAME;
    override readonly title = 'Get Selected Diagram Elements';
    readonly description =
        'Get the element IDs of all elements currently selected in the user-facing diagram UI. ' +
        'Use this only when the user explicitly references their selection ("the selected node", "what I have highlighted"); ' +
        'do not call it speculatively. Pairs with `set-selection` for write-side selection control. ' +
        'Returns an empty list when nothing is selected.';
    readonly inputSchema = GetSelectionInputSchema;
    override readonly outputSchema = GetSelectionOutputSchema;

    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    protected async createResult(_params: GetSelectionInput): Promise<McpToolResult> {
        const response = await requestActionOrFail(this.actionDispatcher, GetSelectionAction.create(), this.timeoutMs, this.name);
        const selectedElementIds = this.encodeIds(response.selectedElementsIDs);
        const selectedIdsStr = selectedElementIds.map(id => `- ${id}`).join('\n');
        return this.success(`Following element IDs are selected:\n${selectedIdsStr}`, { selectedElementIds });
    }
}
