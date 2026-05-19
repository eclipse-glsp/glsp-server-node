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

import { ClientActionKinds, isGBoundsAware, RequestExportAction } from '@eclipse-glsp/server';
import { Role } from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpResourceContent, McpToolError } from '../../server/mcp-handler-shared';
import { McpDiagramScopedInputSchema } from '../../server/mcp-input-schemas';
import { McpMimeType } from '../../server/mcp-mime-types';
import { McpProgressReporter } from '../../server/mcp-progress-reporter';
import { AbstractMcpDiagramResourceHandler, McpResourceUri } from '../../server/mcp-resource-handler';

export const DiagramPngInputSchema = McpDiagramScopedInputSchema.extend({
    scale: z
        .number()
        .min(0.1)
        .max(4)
        .optional()
        .describe(
            "Multiplier applied to the diagram's natural extent (range 0.1..4). Use values >1 for " +
                'sharper-than-default renders, <1 for thumbnails. Ignored when `width` or `height` is supplied.'
        ),
    width: z
        .number()
        .int()
        .min(1)
        .max(8192)
        .optional()
        .describe('Override the rendered width in pixels. When given alone, the height is derived from the diagram aspect ratio.'),
    height: z
        .number()
        .int()
        .min(1)
        .max(8192)
        .optional()
        .describe('Override the rendered height in pixels. When given alone, the width is derived from the diagram aspect ratio.'),
    timeoutMs: z
        .number()
        .int()
        .min(100)
        .max(60000)
        .optional()
        .describe('Override the default render timeout in milliseconds (100–60000). Useful for very large diagrams.')
});
export type DiagramPngInput = z.infer<typeof DiagramPngInputSchema>;

/** Rendering lives on the client — `RequestExportAction('png')` routes to the registered PNG exporter, which returns base64 via `ExportResultAction`. */
@injectable()
export class DiagramPngMcpResourceHandler extends AbstractMcpDiagramResourceHandler<DiagramPngInput> {
    /** Default timeout (in ms) used when the call doesn't override `timeoutMs`. Override via subclass + rebind. */
    protected readonly defaultTimeoutMs: number = 5000;

    /**
     * Default `scale` multiplier when the caller doesn't pin `width`/`height`/`scale`. `1` means
     * "render at the diagram's natural extent" — sharp because the client rasterises the SVG
     * at the requested size. Adopters override (e.g. to `2` for a high-DPI deployment) via
     * subclass + rebind.
     */
    protected readonly defaultScale: number = 1;

    static readonly NAME = 'diagram-png';
    readonly name = DiagramPngMcpResourceHandler.NAME;
    override readonly title = 'Diagram Model PNG';
    readonly description =
        'Render the session diagram as a base64-encoded PNG screenshot of its current visible state. ' +
        'Includes all nodes, edges, and their styling — useful when a visual answer would help the agent ' +
        '(layout reasoning, confirming a recently-created element looks right, sharing the diagram with the user). ' +
        "Defaults to a sharp render at the diagram's natural extent; pass `scale` to multiply, " +
        'or `width`/`height` to pin specific dimensions. ' +
        'Requires a connected frontend client to perform the render and is subject to a timeout if no response arrives. ' +
        'For a structured-text view of the model use `diagram-model` instead; for vector output use `diagram-svg`.';
    readonly mimeType: McpMimeType = 'image/png';
    readonly uri: McpResourceUri = { template: 'glsp://diagrams/{sessionId}/png' };
    /** Both the user (visual artifact) and the assistant (visual reasoning) consume the rendered diagram. */
    override readonly audience: Role[] = ['user', 'assistant'];
    /** Useful when relevant, but not always-relevant — clients may skip when text-only reasoning suffices. */
    override readonly priority = 0.6;
    // `lastModified` intentionally omitted: we have no cheap, accurate freshness signal for the
    // rendered PNG (the model state doesn't track a "rendered at" timestamp), and a stale value
    // would mislead clients.
    override readonly toolAlternativeInputSchema = DiagramPngInputSchema;

    @inject(McpProgressReporter) protected progress: McpProgressReporter;

    @inject(ClientActionKinds) protected clientActionKinds: Set<string>;

    /** Skip-bind when the GLSP client doesn't speak `RequestExportAction` — every read would otherwise time out. */
    override canRegister(): boolean {
        return this.clientActionKinds.has(RequestExportAction.KIND);
    }

    protected async createResult({ scale, width, height, timeoutMs }: DiagramPngInput): Promise<McpResourceContent> {
        const resolved = this.resolveSize(scale, width, height);
        // Best-effort beat for clients that opted in via `_meta.progressToken`; no-ops otherwise.
        await this.progress.emit({ progress: 0, message: 'Awaiting client-side PNG render…' });
        const response = await this.requestAction(
            RequestExportAction.create('png', { formatOptions: { width: resolved.width, height: resolved.height } }),
            timeoutMs ?? this.defaultTimeoutMs
        );
        // A misbehaving exporter strategy returning text-encoded data here would silently corrupt the blob; fail loudly instead.
        if (response.encoding !== 'base64') {
            throw new McpToolError(`PNG export returned unexpected encoding '${response.encoding}'; expected 'base64'.`);
        }
        return { blob: response.data };
    }

    /**
     * Resolve the final render size with this precedence:
     * - `width` and `height` both given → use as-is.
     * - only one of `width`/`height` given → derive the other from the diagram aspect ratio.
     * - neither dimension given → natural × (`scale` ?? {@link defaultScale}).
     */
    protected resolveSize(
        scale: number | undefined,
        width: number | undefined,
        height: number | undefined
    ): { width: number; height: number } {
        if (width !== undefined && height !== undefined) {
            return { width, height };
        }
        const natural = this.computeNaturalSize();
        if (width !== undefined) {
            return { width, height: Math.max(1, Math.round(width * (natural.height / natural.width))) };
        }
        if (height !== undefined) {
            return { width: Math.max(1, Math.round(height * (natural.width / natural.height))), height };
        }
        const factor = scale ?? this.defaultScale;
        return {
            width: Math.max(1, Math.round(natural.width * factor)),
            height: Math.max(1, Math.round(natural.height * factor))
        };
    }

    /**
     * Compute the diagram's natural extent as the bounding box of every {@link isGBoundsAware}
     * element with both `position` and `size`. Throws when the model has no positioned elements
     * — a 1×1 PNG of an empty diagram is technically renderable but useless, and surfacing it
     * as a self-correctable error lets the LLM react (e.g. wait for layout, ask the user).
     */
    protected computeNaturalSize(): { width: number; height: number } {
        let maxX = 0;
        let maxY = 0;
        for (const id of this.modelState.index.allIds()) {
            const element = this.modelState.index.get(id);
            if (!element || !isGBoundsAware(element)) {
                continue;
            }
            const position = element.position;
            const size = element.size;
            if (position && size && size.width > 0 && size.height > 0) {
                maxX = Math.max(maxX, position.x + size.width);
                maxY = Math.max(maxY, position.y + size.height);
            }
        }
        if (maxX <= 0 || maxY <= 0) {
            throw new McpToolError(
                'Diagram has no positioned elements yet — render once after layout completes, or pass `width` / `height` explicitly.'
            );
        }
        return { width: Math.ceil(maxX), height: Math.ceil(maxY) };
    }
}
