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

import { ApplyLabelEditOperation, ChangeBoundsOperation, GEdge, GModelRoot, GNode } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolError, McpToolResult } from '../../server/mcp-handler-shared';
import {
    ElementIdentitySchema,
    McpDiagramScopedInputSchema,
    dispatchedCommands,
    elementId,
    position
} from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';
import { formatNoticeList } from '../../util/mcp-util';

/** Strict — any unknown field on the size object surfaces as a validation error. */
export const NodeSizeSchema = z.strictObject({
    width: z.number().positive().describe('Width of the element in diagram space (must be > 0).'),
    height: z.number().positive().describe('Height of the element in diagram space (must be > 0).')
});

/** Single node-modification entry. Strict so an LLM-typoed field surfaces as a validation error instead of being silently dropped. */
export const ModifyNodeSpecSchema = z.strictObject({
    elementId,
    position: position
        .optional()
        .describe(
            'Position where the node should be moved to, relative to the parent element ' +
                '(identical to absolute diagram coordinates for direct children of the root, which is the common case). ' +
                'Matches the `position` reported by `query-elements`. Note `create-nodes` takes absolute coordinates instead.'
        ),
    size: NodeSizeSchema.optional().describe('New size of the node'),
    text: z.string().optional().describe("Label text to use instead (given that the element's type allows for labels).")
});

export const ModifyNodesInputSchema = McpDiagramScopedInputSchema.extend({
    nodes: z
        .array(ModifyNodeSpecSchema)
        .min(1)
        .describe('Array of node changes — each entry needs `elementId` plus the fields to update. Must include at least one change.')
});
export type ModifyNodesInput = z.infer<typeof ModifyNodesInputSchema>;

export const ModifyNodesOutputSchema = z.object({
    modifiedNodes: z
        .array(ElementIdentitySchema)
        .describe('Identity of each node whose change request was dispatched (post-modification labels).'),
    dispatchedCommands,
    errors: z.array(z.string()).describe('Per-input failure messages; absent or empty when every input succeeded.'),
    warnings: z
        .array(z.string())
        .describe(
            'Soft notices for inputs whose change applied with caveats (e.g. `text` supplied for a node whose type has no editable label).'
        )
});
export type ModifyNodesOutput = z.infer<typeof ModifyNodesOutputSchema>;

@injectable()
export class ModifyNodesMcpToolHandler extends OperationMcpDiagramToolHandler<ModifyNodesInput, ModifyNodesOutput> {
    static readonly NAME = 'modify-nodes';
    readonly name = ModifyNodesMcpToolHandler.NAME;
    override readonly title = 'Modify Diagram Nodes';
    readonly description =
        'Modify one or more existing nodes by changing their position, size, and/or label text. ' +
        'When modifying position or size, absolutely consider the visual alignment with other nodes — ' +
        'use `query-elements` (inspect mode) first to understand the layout. ' +
        'Each change entry can include any combination of `position`, `size`, and `text`; omitted fields keep their current value. ' +
        'This operation modifies the diagram state and requires user approval. ' +
        'For edges (reconnect / routing-points), use `modify-edges` instead.';
    readonly inputSchema = ModifyNodesInputSchema;
    override readonly outputSchema = ModifyNodesOutputSchema;

    protected async createResult({ nodes }: ModifyNodesInput): Promise<McpToolResult> {
        const elements = this.lookupElements(nodes, change => change.elementId);

        // Reject edge ids — they have no `position`/`size` semantics and would fail downstream
        // with a misleading "model element not found" error from the operation handler. Aliases
        // are sequential across all element kinds, so an LLM passing an arbitrary id may hit an edge.
        const wrongType = elements.filter(([, element]) => element instanceof GEdge).map(([change]) => `'${change.elementId}'`);
        if (wrongType.length) {
            throw new McpToolError(`modify-nodes does not accept edges — got: ${wrongType.join(', ')}. Use modify-edges for edges.`);
        }

        // The root has no bounds of its own, and a `text` edit against it would rename whatever
        // top-level `GLabel` the label provider happens to find first.
        const roots = elements.filter(([, element]) => element instanceof GModelRoot).map(([change]) => `'${change.elementId}'`);
        if (roots.length) {
            throw new McpToolError(
                `modify-nodes does not accept the diagram root — got: ${roots.join(', ')}. Target a node inside the diagram instead.`
            );
        }

        // Core's `GModelChangeBoundsOperationHandler` only applies bounds to a `GNode`
        // (`findByClass`). Label-only edits stay open to every element kind.
        const unmovable = elements
            .filter(([change, element]) => (change.position || change.size) && !(element instanceof GNode))
            .map(([change, element]) => `'${change.elementId}' (type '${element.type}')`);
        if (unmovable.length) {
            throw new McpToolError(
                `modify-nodes can only change \`position\` / \`size\` of nodes — got: ${unmovable.join(', ')}. ` +
                    'Use `query-elements` (inspect mode) to find node ids, or target the parent node.'
            );
        }

        // Modifications are independent of each other — dispatch in parallel. `allSettled` so one
        // failed dispatch surfaces in `errors` instead of rejecting the whole call and losing the
        // other outcomes, which have already mutated the model.
        const dispatched: Array<{ promise: Promise<void>; inputId: string }> = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        elements.forEach(([change, element]) => {
            const { size, position, text } = change;
            const realId = this.aliasService.lookup(change.elementId);

            if (!size && !position && !text) {
                errors.push(`No change requested for node '${change.elementId}' — provide \`position\`, \`size\` or a non-empty \`text\`.`);
                return;
            }

            if ((size || position) && element instanceof GNode) {
                const newSize = size ?? element.size;
                const newPosition = position ?? element.position;

                const operation = ChangeBoundsOperation.create([{ elementId: realId, newSize, newPosition }]);
                dispatched.push({ promise: this.actionDispatcher.dispatch(operation), inputId: change.elementId });
            }

            if (text) {
                const labelId = this.labelProvider.getLabel(element)?.id;
                if (labelId) {
                    const operation = ApplyLabelEditOperation.create({ labelId, text });
                    dispatched.push({ promise: this.actionDispatcher.dispatch(operation), inputId: change.elementId });
                } else {
                    warnings.push(
                        `Ignored \`text\` for '${change.elementId}' (type '${element.type}') — this element has no editable label.`
                    );
                }
            }
        });

        const results = await Promise.allSettled(dispatched.map(entry => entry.promise));
        const modifiedInputIds = new Set<string>();
        results.forEach((result, index) => {
            const { inputId } = dispatched[index];
            if (result.status === 'rejected') {
                const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
                errors.push(`Failed to modify node '${inputId}': ${reason}`);
            } else {
                modifiedInputIds.add(inputId);
            }
        });

        const modifiedNodes = [...modifiedInputIds]
            .map(inputId => this.describeElement(inputId))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        return this.success(
            `Successfully modified ${modifiedNodes.length} node(s) (in ${dispatched.length} commands)` +
                formatNoticeList('errors', errors) +
                formatNoticeList('warnings', warnings),
            { modifiedNodes, dispatchedCommands: dispatched.length, errors, warnings }
        );
    }
}
