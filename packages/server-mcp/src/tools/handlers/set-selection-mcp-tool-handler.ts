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

import { ActionDispatcher, SelectAction, SelectAllAction } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolResult } from '../../server/mcp-handler-shared';
import { McpDiagramScopedInputSchema, elementIds } from '../../server/mcp-input-schemas';
import { AbstractMcpDiagramToolHandler } from '../../server/mcp-tool-handler';

export const SetSelectionInputSchema = McpDiagramScopedInputSchema.extend({
    selectedElementIds: elementIds
        .optional()
        .describe('Element IDs to select. Pass an empty array (or omit + set `clear: true`) to clear the selection.'),
    deselectedElementIds: elementIds.optional().describe('Element IDs to remove from the selection. Used to subtract without replacing.'),
    clear: z
        .boolean()
        .optional()
        .describe('When true, clear the existing selection before applying `selectedElementIds`. Defaults to false (additive).')
});
export type SetSelectionInput = z.infer<typeof SetSelectionInputSchema>;

export const SetSelectionOutputSchema = z.object({
    selectedElementIds: z.array(z.string()).describe('Aliased ids requested for selection.'),
    deselectedElementIds: z.array(z.string()).describe('Aliased ids requested for deselection.'),
    cleared: z.boolean().describe('Whether the existing selection was cleared before applying.')
});

/**
 * Pushes a selection change to the client. Counterpart to `get-selection` — useful for the
 * agent to direct a human reviewer's attention to elements it just modified ("here's what I
 * touched"), or to chain follow-up tools that rely on the visible selection.
 *
 * Read-write hint is honest: the viewport selection state is part of the client environment
 * even though the underlying GModel is unaffected.
 */
@injectable()
export class SetSelectionMcpToolHandler extends AbstractMcpDiagramToolHandler<SetSelectionInput> {
    static readonly NAME = 'set-selection';
    readonly name = SetSelectionMcpToolHandler.NAME;
    override readonly title = 'Set Diagram Selection';
    readonly description =
        'Set the selection of elements on the client UI. Useful to direct a reviewer to a ' +
        'set of elements (e.g. those just created or modified). Pass `clear: true` to replace ' +
        'the existing selection rather than add to it.';
    readonly inputSchema = SetSelectionInputSchema;
    override readonly outputSchema = SetSelectionOutputSchema;
    override readonly readOnlyHint = false;

    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    protected async createResult({ selectedElementIds, deselectedElementIds, clear }: SetSelectionInput): Promise<McpToolResult> {
        const resolvedSelected = this.resolveExistingIds(selectedElementIds);
        const resolvedDeselected = this.resolveExistingIds(deselectedElementIds);

        if (clear) {
            await this.actionDispatcher.dispatch(SelectAllAction.create(false));
        }
        if (resolvedSelected.length > 0 || resolvedDeselected.length > 0) {
            await this.actionDispatcher.dispatch(
                SelectAction.create({ selectedElementsIDs: resolvedSelected, deselectedElementsIDs: resolvedDeselected })
            );
        }

        return this.success(this.summarize(resolvedSelected, resolvedDeselected, clear ?? false), {
            selectedElementIds: this.encodeIds(resolvedSelected),
            deselectedElementIds: this.encodeIds(resolvedDeselected),
            cleared: clear ?? false
        });
    }

    protected summarize(selected: string[], deselected: string[], cleared: boolean): string {
        const parts: string[] = [];
        if (cleared) parts.push('Cleared previous selection.');
        if (selected.length > 0) parts.push(`Selected ${selected.length} element${selected.length === 1 ? '' : 's'}.`);
        if (deselected.length > 0) parts.push(`Deselected ${deselected.length} element${deselected.length === 1 ? '' : 's'}.`);
        return parts.length > 0 ? parts.join(' ') : 'Selection unchanged.';
    }
}
