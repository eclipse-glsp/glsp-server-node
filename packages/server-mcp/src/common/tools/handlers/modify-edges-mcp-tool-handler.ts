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

import { ChangeRoutingPointsOperation, GEdge, ReconnectEdgeOperation } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolError, McpToolResult } from '../../server/mcp-handler-shared';
import {
    ElementIdentitySchema,
    McpDiagramScopedInputSchema,
    dispatchedCommands,
    elementId as elementIdSchema,
    position
} from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';
import { formatNoticeList } from '../../util/mcp-util';

/** Single edge-modification entry. Strict so an LLM-typoed field surfaces as a validation error instead of being silently dropped. */
export const ModifyEdgeSpecSchema = z.strictObject({
    elementId: elementIdSchema,
    sourceElementId: z.string().optional().describe('ID of the source element (must exist in the diagram)'),
    targetElementId: z.string().optional().describe('ID of the target element (must exist in the diagram)'),
    routingPoints: z
        .array(position)
        .optional()
        .describe(
            'Optional array of routing point coordinates that allow for a complex edge path. ' +
                'Using an empty array removes all routing points.'
        )
});

export const ModifyEdgesInputSchema = McpDiagramScopedInputSchema.extend({
    edges: z
        .array(ModifyEdgeSpecSchema)
        .min(1)
        .describe('Array of edge changes — each entry needs `elementId` plus the fields to update. Must include at least one change.')
});
export type ModifyEdgesInput = z.infer<typeof ModifyEdgesInputSchema>;

export const ModifyEdgesOutputSchema = z.object({
    modifiedEdges: z.array(ElementIdentitySchema).describe('Identity of each edge whose change request was dispatched.'),
    dispatchedCommands,
    errors: z.array(z.string()).describe('Per-input failure messages; absent or empty when every input succeeded.')
});

@injectable()
export class ModifyEdgesMcpToolHandler extends OperationMcpDiagramToolHandler<ModifyEdgesInput> {
    static readonly NAME = 'modify-edges';
    readonly name = ModifyEdgesMcpToolHandler.NAME;
    override readonly title = 'Modify Diagram Edges';
    readonly description =
        'Modify one or more existing edges by reconnecting their source/target endpoints or rewriting their routing points. ' +
        'Reconnection (provide both `sourceElementId` and `targetElementId`) and routing-point edits are mutually exclusive ' +
        'per change entry — a reconnect recomputes the path from scratch and ignores `routingPoints`. ' +
        'Pass an empty `routingPoints` array to remove all routing points (snap to a straight line). ' +
        'This operation modifies the diagram state and requires user approval. ' +
        'For nodes (position/size/text), use `modify-nodes` instead.';
    readonly inputSchema = ModifyEdgesInputSchema;
    override readonly outputSchema = ModifyEdgesOutputSchema;

    protected async createResult({ edges }: ModifyEdgesInput): Promise<McpToolResult> {
        const elements = this.lookupElements(edges, change => change.elementId);

        // Type-validate so non-edge ids surface a clear error instead of "model element not found"
        // from the dispatched operation handler. Aliases are sequential across all element kinds,
        // so an LLM passing an arbitrary id may hit a node here.
        const wrongType = elements
            .filter(([, element]) => !(element instanceof GEdge))
            .map(([change, element]) => `'${change.elementId}' (type '${element.type}')`);
        if (wrongType.length) {
            throw new McpToolError(`modify-edges accepts edges only — got: ${wrongType.join(', ')}. Use modify-nodes for nodes.`);
        }

        // Dispatch in parallel via `allSettled` so one failed edge surfaces in `errors`
        // instead of rejecting the whole call and losing the other outcomes.
        const dispatched: Array<{ promise: Promise<void>; realId: string; inputId: string }> = [];
        const errors: string[] = [];
        const modifiedRealIds = new Set<string>();
        elements.forEach(([change]) => {
            const { routingPoints } = change;
            const realId = this.aliasService.lookup(change.elementId);
            const sourceElementId = change.sourceElementId ? this.aliasService.lookup(change.sourceElementId) : undefined;
            const targetElementId = change.targetElementId ? this.aliasService.lookup(change.targetElementId) : undefined;

            if ((sourceElementId && !targetElementId) || (!sourceElementId && targetElementId)) {
                errors.push(`Both source and target ID are required for input: ${JSON.stringify(change)}`);
                return;
            }

            if (sourceElementId && targetElementId) {
                const source = this.modelState.index.find(sourceElementId);
                if (!source) {
                    errors.push(`Source element not found: ${sourceElementId}`);
                    return;
                }
                const target = this.modelState.index.find(targetElementId);
                if (!target) {
                    errors.push(`Target element not found: ${targetElementId}`);
                    return;
                }

                const operation = ReconnectEdgeOperation.create({ edgeElementId: realId, sourceElementId, targetElementId });
                dispatched.push({ promise: this.actionDispatcher.dispatch(operation), realId, inputId: change.elementId });
                modifiedRealIds.add(realId);
                // Routing-point changes are skipped during a reconnect — the edge's path is recomputed from scratch.
                return;
            }

            if (routingPoints) {
                const operation = ChangeRoutingPointsOperation.create([{ elementId: realId, newRoutingPoints: routingPoints }]);
                dispatched.push({ promise: this.actionDispatcher.dispatch(operation), realId, inputId: change.elementId });
                modifiedRealIds.add(realId);
            }
        });

        const results = await Promise.allSettled(dispatched.map(entry => entry.promise));
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                const { realId, inputId } = dispatched[i];
                const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                errors.push(`Failed to modify edge '${inputId}': ${reason}`);
                // The dispatch failed, so this id was *not* modified — drop it from the success list.
                modifiedRealIds.delete(realId);
            }
        });

        const modifiedEdges = [...modifiedRealIds]
            .map(realId => this.describeElement(realId))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        return this.success(
            `Successfully modified ${edges.length - errors.length} edge(s) (in ${dispatched.length} commands)${formatNoticeList('errors', errors)}`,
            { modifiedEdges, dispatchedCommands: dispatched.length, errors }
        );
    }
}
