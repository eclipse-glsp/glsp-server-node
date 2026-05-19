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

import { ClientActionKinds, RequestExportAction } from '@eclipse-glsp/server';
import { Role } from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpResourceContent, McpToolError } from '../../server/mcp-handler-shared';
import { McpDiagramScopedInputSchema } from '../../server/mcp-input-schemas';
import { McpMimeType } from '../../server/mcp-mime-types';
import { McpProgressReporter } from '../../server/mcp-progress-reporter';
import { AbstractMcpDiagramResourceHandler, McpResourceUri } from '../../server/mcp-resource-handler';

export const DiagramSvgInputSchema = McpDiagramScopedInputSchema.extend({
    timeoutMs: z
        .number()
        .int()
        .min(100)
        .max(60000)
        .optional()
        .describe('Override the default render timeout in milliseconds (100–60000). Useful for very large diagrams.')
});
export type DiagramSvgInput = z.infer<typeof DiagramSvgInputSchema>;

/**
 * Vector counterpart of {@link DiagramPngMcpResourceHandler}. Emits the diagram as raw SVG
 * markup (text-encoded). No `width`/`height` knobs because SVG is vector — clients (and
 * downstream rasterisers) scale it freely.
 */
@injectable()
export class DiagramSvgMcpResourceHandler extends AbstractMcpDiagramResourceHandler<DiagramSvgInput> {
    /** Default timeout (in ms) used when the call doesn't override `timeoutMs`. Override via subclass + rebind. */
    protected readonly defaultTimeoutMs: number = 5000;

    static readonly NAME = 'diagram-svg';
    readonly name = DiagramSvgMcpResourceHandler.NAME;
    override readonly title = 'Diagram Model SVG';
    readonly description =
        'Render the session diagram as SVG markup of its current visible state. ' +
        'Vector format — scales without quality loss, ideal for embedding in documentation, ' +
        'further programmatic processing, or post-export rasterisation at arbitrary resolutions. ' +
        'Requires a connected frontend client to perform the render and is subject to a timeout if no response arrives. ' +
        'Use `diagram-png` instead when you need a ready-to-display raster image; ' +
        '`diagram-model` is the structured-text alternative for content-only reasoning.';
    readonly mimeType: McpMimeType = 'image/svg+xml';
    readonly uri: McpResourceUri = { template: 'glsp://diagrams/{sessionId}/svg' };
    /** Both the user (visual artifact) and the assistant (visual reasoning) consume the rendered diagram. */
    override readonly audience: Role[] = ['user', 'assistant'];
    /** Useful when relevant, but not always-relevant — clients may skip when text-only reasoning suffices. */
    override readonly priority = 0.6;
    override readonly toolAlternativeInputSchema = DiagramSvgInputSchema;

    @inject(McpProgressReporter) protected progress: McpProgressReporter;

    @inject(ClientActionKinds) protected clientActionKinds: Set<string>;

    /** Skip-bind when the GLSP client doesn't speak `RequestExportAction`. */
    override canRegister(): boolean {
        return this.clientActionKinds.has(RequestExportAction.KIND);
    }

    protected async createResult({ timeoutMs }: DiagramSvgInput): Promise<McpResourceContent> {
        // Best-effort beat for clients that opted in via `_meta.progressToken`; no-ops otherwise.
        await this.progress.emit({ progress: 0, message: 'Awaiting client-side SVG render…' });
        const response = await this.requestAction(RequestExportAction.create('svg'), timeoutMs ?? this.defaultTimeoutMs);
        // SVG is text-encoded — base64 encoding here would mean an exporter mis-classified its payload.
        if (response.encoding !== 'text') {
            throw new McpToolError(`SVG export returned unexpected encoding '${response.encoding}'; expected 'text'.`);
        }
        return { text: response.data };
    }
}
