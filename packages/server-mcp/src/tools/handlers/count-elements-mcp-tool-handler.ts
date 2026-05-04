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

import { injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpDiagramScopedInputSchema, AbstractMcpDiagramToolHandler, McpToolResult } from '../../server';

export const CountElementsInputSchema = McpDiagramScopedInputSchema;
export type CountElementsInput = z.infer<typeof CountElementsInputSchema>;

export const CountElementsOutputSchema = z.object({
    total: z.number().int().describe('Total element count across the diagram (root included).'),
    countsByType: z.record(z.string(), z.number().int()).describe('Element count grouped by `GModelElement.type`.')
});

/**
 * Counts elements in the diagram, grouped by type. Cheap alternative to dumping the full
 * `diagram-model` resource when the agent only needs to know "how big is this" or "do any
 * elements of type X exist".
 */
@injectable()
export class CountElementsMcpToolHandler extends AbstractMcpDiagramToolHandler<CountElementsInput> {
    static readonly NAME = 'count-elements';
    readonly name = CountElementsMcpToolHandler.NAME;
    override readonly title = 'Count Diagram Elements';
    readonly description =
        'Count the elements in the session diagram, grouped by element type. ' +
        'Cheap sizing primitive — useful before deciding whether to load the full model with `diagram-model` ' +
        '(expensive on large diagrams) or whether a filtered `query-elements` call would suffice. ' +
        'Returns total count plus a per-type breakdown.';
    readonly inputSchema = CountElementsInputSchema;
    override readonly outputSchema = CountElementsOutputSchema;

    protected async createResult(_params: CountElementsInput): Promise<McpToolResult> {
        const countsByType: Record<string, number> = {};
        let total = 0;
        for (const id of this.modelState.index.allIds()) {
            const element = this.modelState.index.get(id);
            if (!element) {
                continue;
            }
            countsByType[element.type] = (countsByType[element.type] ?? 0) + 1;
            total += 1;
        }
        return this.success(this.renderMarkdown(total, countsByType), { total, countsByType });
    }

    protected renderMarkdown(total: number, countsByType: Record<string, number>): string {
        const sorted = Object.entries(countsByType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const rows = sorted.map(([type, count]) => `- ${type}: ${count}`).join('\n');
        return `Total elements: ${total}\n\nBy type:\n${rows}`;
    }
}
