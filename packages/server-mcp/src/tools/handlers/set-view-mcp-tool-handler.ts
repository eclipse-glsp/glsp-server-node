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

import {
    Action,
    ActionDispatcher,
    CenterAction,
    FitToScreenAction,
    GetViewportAction,
    OriginViewportAction,
    Point,
    SetViewportAction
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import {
    McpDiagramScopedInputSchema,
    AbstractMcpDiagramToolHandler,
    McpToolError,
    McpToolResult,
    elementIds,
    position,
    requestActionOrFail
} from '../../server';

export const VIEWPORT_ACTIONS = ['fit-to-screen', 'center-on-elements', 'reset-viewport', 'set-viewport'] as const;
export type ViewportAction = (typeof VIEWPORT_ACTIONS)[number];

export const SetViewInputSchema = McpDiagramScopedInputSchema.extend({
    action: z.enum(VIEWPORT_ACTIONS).describe('The type of viewport change action to be undertaken.'),
    elementIds: elementIds
        .optional()
        .describe(
            "Elements to center on or fit (relevant for 'center-on-elements' and 'fit-to-screen'). Omit to target the whole diagram."
        ),
    zoom: z
        .number()
        .min(0.05)
        .max(20)
        .optional()
        .describe(
            "Absolute zoom level for `action: 'set-viewport'` (range 0.05..20, where 1 is 100% / native scale). " +
                'Ignored by other actions. Omit to keep the current zoom while changing scroll.'
        ),
    scroll: position
        .optional()
        .describe(
            "Absolute scroll position for `action: 'set-viewport'`, in diagram coordinates (top-left of the visible area). " +
                'Ignored by other actions. Omit to keep the current scroll while changing zoom.'
        )
});
export type SetViewInput = z.infer<typeof SetViewInputSchema>;

export const SetViewOutputSchema = z.object({
    action: z.enum(VIEWPORT_ACTIONS).describe('Echo of the viewport action that was applied.'),
    targetIds: z
        .array(z.string())
        .optional()
        .describe(
            "Aliased ids the action targeted (resolved from input or fall-back of all elements). Omitted for `'set-viewport'` since that action targets coordinates, not elements."
        ),
    viewport: z
        .object({
            scroll: position,
            zoom: z.number()
        })
        .optional()
        .describe("Resolved final viewport when `action: 'set-viewport'` was applied (current values merged with the supplied overrides).")
});

@injectable()
export class SetViewMcpToolHandler extends AbstractMcpDiagramToolHandler<SetViewInput> {
    /** Timeout (in ms) for the `GetViewportAction` round-trip used by `set-viewport` partial updates. Override via subclass + rebind. */
    protected readonly viewportQueryTimeoutMs: number = 5000;

    static readonly NAME = 'set-view';
    readonly name = SetViewMcpToolHandler.NAME;
    override readonly title = 'Set Diagram Viewport';
    readonly description =
        "Set the viewport of the session's associated UI client to focus the user's attention. " +
        '`fit-to-screen` zooms+pans so all elements (or the listed `elementIds`) are visible; ' +
        '`center-on-elements` pans without changing zoom, useful to highlight a specific element after creating or modifying it; ' +
        '`reset-viewport` returns the camera to the origin at default zoom; ' +
        '`set-viewport` applies an explicit `zoom` and/or `scroll` (omit either to preserve its current value). ' +
        'Only invoke on explicit user request or when the user clearly benefits from a viewport nudge ' +
        '(e.g. just created an element off-screen). Note this changes client-side viewport state but not the model.';
    readonly inputSchema = SetViewInputSchema;
    override readonly outputSchema = SetViewOutputSchema;
    /** Viewport IS client-side environment; dispatching mutates it, so the read-base default doesn't honestly apply. */
    override readonly readOnlyHint = false;

    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    protected async createResult({ action, elementIds, zoom, scroll }: SetViewInput): Promise<McpToolResult> {
        if (action === 'set-viewport') {
            return this.applyExplicitViewport(zoom, scroll);
        }
        const resolvedIds = elementIds ? elementIds.map(id => this.aliasService.lookup(id)) : this.modelState.index.allIds();
        const dispatchAction = this.buildIntentAction(action, resolvedIds);
        await this.actionDispatcher.dispatch(dispatchAction);
        return this.success('Viewport successfully changed', { action, targetIds: this.encodeIds(resolvedIds) });
    }

    /**
     * Map an intent-driven viewport action (`fit-to-screen`, `center-on-elements`,
     * `reset-viewport`) to the matching sprotty action. The exhaustive switch lets TypeScript
     * narrow the remaining `'set-viewport'` case out at compile time, so we don't need a
     * runtime guard.
     */
    protected buildIntentAction(action: Exclude<ViewportAction, 'set-viewport'>, resolvedIds: string[]): Action {
        switch (action) {
            case 'fit-to-screen':
                return FitToScreenAction.create(resolvedIds, { animate: true, padding: 20 });
            case 'center-on-elements':
                return CenterAction.create(resolvedIds, { animate: true, retainZoom: true });
            case 'reset-viewport':
                return OriginViewportAction.create({ animate: true });
        }
    }

    /**
     * Build the merged viewport for `set-viewport`: query the current viewport from the client,
     * overlay the caller's `zoom` / `scroll` overrides, dispatch a {@link SetViewportAction}.
     * Querying lets the LLM specify only one axis of change — the other is preserved instead of
     * snapping to a placeholder default.
     */
    protected async applyExplicitViewport(zoom: number | undefined, scroll: Point | undefined): Promise<McpToolResult> {
        if (zoom === undefined && scroll === undefined) {
            throw new McpToolError("'set-viewport' requires at least one of `zoom` or `scroll`.");
        }
        const rootId = this.modelState.root.id;
        const current = await requestActionOrFail(
            this.actionDispatcher,
            GetViewportAction.create(),
            this.viewportQueryTimeoutMs,
            this.name
        );
        // Some clients respond before layout completes — fall back to origin / 1× when fields are null.
        const newViewport = {
            scroll: scroll ?? (Point.isValid(current.viewport.scroll) ? current.viewport.scroll : Point.ORIGIN),
            zoom: zoom ?? (Number.isFinite(current.viewport.zoom) ? current.viewport.zoom : 1)
        };
        await this.actionDispatcher.dispatch(SetViewportAction.create(rootId, newViewport, { animate: true }));
        return this.success(`Viewport set to scroll=(${newViewport.scroll.x}, ${newViewport.scroll.y}) zoom=${newViewport.zoom}`, {
            action: 'set-viewport',
            viewport: newViewport
        });
    }
}
