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

import { LayoutEngine, LayoutOperation } from '@eclipse-glsp/server';
import { inject, injectable, optional } from 'inversify';
import * as z from 'zod/v4';
import { McpDiagramScopedInputSchema, McpToolResult, OperationMcpDiagramToolHandler } from '../../server';

export const LayoutInputSchema = McpDiagramScopedInputSchema;
export type LayoutInput = z.infer<typeof LayoutInputSchema>;

export const LayoutOutputSchema = z.object({
    applied: z.boolean().describe('Always true on success — surfaced for parity with other operations.')
});

/** Not registered by default: requires an adopter-supplied `LayoutEngine` to bind, which only some GLSP servers ship. */
@injectable()
export class LayoutMcpToolHandler extends OperationMcpDiagramToolHandler<LayoutInput> {
    static readonly NAME = 'layout';
    readonly name = LayoutMcpToolHandler.NAME;
    override readonly title = 'Auto-Layout Diagram';
    readonly description =
        "Trigger automatic layout computation for the given session's diagram, repositioning all nodes and " +
        'rerouting all edges according to the configured layout engine. ' +
        'Use this only when the user explicitly asks for "automatic layout" or similar — it overwrites every ' +
        'manual position in the diagram and is generally a destructive change for hand-tuned layouts. ' +
        'For targeted positional edits prefer `modify-nodes` / `modify-edges`. ' +
        'Adopters who do not bind a `LayoutEngine` will not see this tool registered.';
    readonly inputSchema = LayoutInputSchema;
    override readonly outputSchema = LayoutOutputSchema;

    @inject(LayoutEngine) @optional() protected layoutEngine?: LayoutEngine;

    /** Skip-bind when no `LayoutEngine` is bound — every dispatch would otherwise no-op. */
    override canRegister(): boolean {
        return this.layoutEngine !== undefined;
    }

    protected async createResult(_params: LayoutInput): Promise<McpToolResult> {
        await this.actionDispatcher.dispatch(LayoutOperation.create());
        return this.success('Automatic layout applied', { applied: true });
    }
}
