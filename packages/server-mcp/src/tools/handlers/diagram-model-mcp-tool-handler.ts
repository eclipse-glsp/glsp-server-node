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

import { GModelElement } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpModelSerializer } from '../../resources/services/mcp-model-serializer';
import { McpDiagramScopedInputSchema, AbstractMcpDiagramToolHandler, McpToolResult } from '../../server';

export const DiagramModelInputSchema = McpDiagramScopedInputSchema;
export type DiagramModelInput = z.infer<typeof DiagramModelInputSchema>;

/** `.loose()` lets adopter element types attach extra fields (position, size, …) without widening the schema each time. */
export const DiagramModelElementSchema = z
    .object({
        id: z.string(),
        type: z.string(),
        parentId: z.string().optional()
    })
    .loose();

export const DiagramModelOutputSchema = z.object({
    sessionId: z.string(),
    elements: z.array(DiagramModelElementSchema)
});

@injectable()
export class DiagramModelMcpToolHandler extends AbstractMcpDiagramToolHandler<DiagramModelInput> {
    static readonly NAME = 'diagram-model';
    readonly name = DiagramModelMcpToolHandler.NAME;
    override readonly title = 'Diagram Model Structure';
    readonly description =
        'Get the complete GLSP model for a session as a markdown structure. ' +
        'Includes all nodes, edges, and their relevant properties. ' +
        'For large diagrams, prefer `query-elements` (filtered listing) or `count-elements` (size summary) ' +
        'before falling back to this full dump.';
    readonly inputSchema = DiagramModelInputSchema;
    override readonly outputSchema = DiagramModelOutputSchema;

    @inject(McpModelSerializer) protected serializer: McpModelSerializer;

    protected createResult({ sessionId }: DiagramModelInput): McpToolResult {
        const root = this.modelState.root;
        const structured = this.serializer.serializeStructured(root);
        const count = Array.isArray(structured.elements) ? structured.elements.length : 0;
        return this.success(this.summarizeModel(root, count), { sessionId, ...structured });
    }

    /** Builds the LLM-facing summary line. Override to customize per-adopter wording. */
    protected summarizeModel(root: GModelElement, elementCount: number): string {
        return `Diagram '${this.aliasService.alias(root.id)}' (${root.type}): ${elementCount} element(s) total. Full structure in structuredContent.`;
    }
}
