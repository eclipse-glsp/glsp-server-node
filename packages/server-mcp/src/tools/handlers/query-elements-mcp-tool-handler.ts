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
import {
    McpDiagramScopedInputSchema,
    AbstractMcpDiagramToolHandler,
    McpElementsNotFoundError,
    McpToolResult,
    elementIds as elementIdsSchema
} from '../../server';

export const QueryElementsInputSchema = McpDiagramScopedInputSchema.extend({
    elementIds: elementIdsSchema
        .optional()
        .describe('Inspect-mode trigger. When set, returns rich per-element data and ignores the filter fields. Throws on unknown id.'),
    types: z.array(z.string()).optional().describe('List-mode type filter. Empty/omitted = any. Ignored when `elementIds` is set.'),
    labelMatch: z.string().optional().describe('List-mode case-insensitive substring on direct-child `GLabel.text`.'),
    limit: z.number().int().min(1).max(1000).optional().describe('List-mode cap, 1–1000. Defaults to 100.')
});
export type QueryElementsInput = z.infer<typeof QueryElementsInputSchema>;

export const QueryElementMatchSchema = z.object({
    id: z.string(),
    type: z.string(),
    label: z.string().optional()
});

/** `.loose()` lets adopter element types attach extra fields (position, size, …) without widening the schema each time. */
export const DiagramElementSchema = z
    .object({
        id: z.string(),
        type: z.string(),
        parentId: z.string().optional()
    })
    .loose();

export const QueryElementsOutputSchema = z.object({
    mode: z.enum(['list', 'inspect']).describe('Echoes which mode the call ran in.'),
    matches: z.array(QueryElementMatchSchema).optional().describe('Present in `list` mode: slim id/type/label entries.'),
    elements: z.array(DiagramElementSchema).optional().describe('Present in `inspect` mode: rich per-element detail.'),
    truncated: z.boolean().optional().describe('Present in `list` mode: true when more elements matched than `limit`.'),
    expandedFromContainers: z
        .array(z.string())
        .optional()
        .describe(
            'Present in `inspect` mode when one or more requested ids referred to containers — lists those container ids. ' +
                'The `elements` array then includes the container plus its descendants.'
        )
});

/** Two-mode element query — list/filter or inspect-by-id, discriminated by `elementIds` presence. */
@injectable()
export class QueryElementsMcpToolHandler extends AbstractMcpDiagramToolHandler<QueryElementsInput> {
    static readonly NAME = 'query-elements';
    readonly name = QueryElementsMcpToolHandler.NAME;
    override readonly title = 'Query Diagram Elements';
    readonly description =
        'Find or inspect elements in the session diagram. Pass `elementIds` to inspect specific ' +
        'elements in detail (rich per-element data). Pass `types` and/or `labelMatch` to search by ' +
        'filter (slim id/type/label summaries with truncation). Useful as a precursor to the ' +
        'create/modify/delete tools, and a cheaper alternative to `diagram-model` on large diagrams.';
    readonly inputSchema = QueryElementsInputSchema;
    override readonly outputSchema = QueryElementsOutputSchema;

    @inject(McpModelSerializer) protected serializer: McpModelSerializer;

    /** List-mode result cap when the call doesn't override `limit`. Override via subclass. */
    protected readonly defaultLimit: number = 100;

    protected async createResult(params: QueryElementsInput): Promise<McpToolResult> {
        return params.elementIds && params.elementIds.length > 0 ? this.inspect(params.elementIds) : this.list(params);
    }

    protected inspect(inputIds: string[]): McpToolResult {
        const { realIds, missingIds } = this.resolveIds(inputIds);
        if (missingIds.length > 0) {
            throw new McpElementsNotFoundError(missingIds);
        }
        const elements: GModelElement[] = realIds.map(id => this.modelState.index.get(id)!);
        // Per-input serialize lets us identify which inputs caused expansion: the serializer
        // walks descendants for containers, so a 1-input call may produce N output entries.
        // The structural-children check the previous version used overstated this — a leaf node
        // with a label child counts as having `children.length > 0` but doesn't produce extra
        // entries because the serializer's adjuster drops labels.
        const expandedFromContainers = elements
            .filter(element => {
                // `serializeStructuredArray` returns an open `Record<string, unknown>` per the
                // `McpStructuredContent` contract; narrow before reading `.elements.length`.
                const entries = this.serializer.serializeStructuredArray([element]).elements;
                return Array.isArray(entries) && entries.length > 1;
            })
            .map(element => this.aliasService.alias(element.id));
        // Serializer's `serializeStructuredArray` already returns `{ elements: [...] }`; spread to keep one source of truth.
        return this.success(this.summarizeInspect(elements, expandedFromContainers), {
            mode: 'inspect',
            ...this.serializer.serializeStructuredArray(elements),
            ...(expandedFromContainers.length > 0 ? { expandedFromContainers } : {})
        });
    }

    /** Builds the LLM-facing summary for inspect mode. Override to customize per-adopter wording. */
    protected summarizeInspect(elements: GModelElement[], expandedFromContainers: string[]): string {
        const lines = elements.map(element => `- ${this.aliasService.alias(element.id)} (${element.type})`);
        const expansionNote =
            expandedFromContainers.length > 0 ? `\nContainer(s) ${expandedFromContainers.join(', ')} expanded to include descendants.` : '';
        return `Inspected ${elements.length} element(s); full data in structuredContent.\n${lines.join('\n')}${expansionNote}`;
    }

    protected list({ types, labelMatch, limit }: QueryElementsInput): McpToolResult {
        const cap = limit ?? this.defaultLimit;
        const typeFilter = types && types.length > 0 ? new Set(types) : undefined;
        const needle = labelMatch?.toLowerCase();

        const matches: { id: string; type: string; label?: string }[] = [];
        let truncated = false;
        for (const id of this.modelState.index.allIds()) {
            const element = this.modelState.index.get(id);
            if (!element) {
                continue;
            }
            if (typeFilter && !typeFilter.has(element.type)) {
                continue;
            }
            const label = this.labelProvider.getLabel(element)?.text;
            if (needle !== undefined && !label?.toLowerCase().includes(needle)) {
                continue;
            }
            if (matches.length >= cap) {
                truncated = true;
                break;
            }
            matches.push({ id: this.aliasService.alias(element.id), type: element.type, ...(label !== undefined ? { label } : {}) });
        }

        const summary = matches.length === 0 ? 'No elements matched the query.' : this.renderMarkdown(matches, truncated);
        return this.success(summary, { mode: 'list', matches, truncated });
    }

    protected renderMarkdown(matches: { id: string; type: string; label?: string }[], truncated: boolean): string {
        const rows = matches.map(match => `- ${match.id} (${match.type})${match.label ? ` — "${match.label}"` : ''}`).join('\n');
        const tail = truncated ? '\n\n_(truncated — increase `limit` or refine filters to see more)_' : '';
        return `Matched ${matches.length} element${matches.length === 1 ? '' : 's'}:\n${rows}${tail}`;
    }
}
