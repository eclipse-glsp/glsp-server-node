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

import { ApplyLabelEditOperation, ChangeBoundsOperation, GEdge, GShapeElement } from '@eclipse-glsp/server';
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
    position: position.optional().describe('Position where the node should be moved to (absolute diagram coordinates)'),
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
    warnings: z
        .array(z.string())
        .describe(
            'Soft notices for inputs whose change applied with caveats (e.g. `text` supplied for a node whose type has no editable label).'
        )
});

@injectable()
export class ModifyNodesMcpToolHandler extends OperationMcpDiagramToolHandler<ModifyNodesInput> {
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

        // Reject any other non-shape kinds (labels, compartments, ports, custom kinds) — they
        // reach the index too and would silently produce no-op or undefined-bounds operations.
        const nonShape = elements.filter(([, element]) => !(element instanceof GShapeElement)).map(([change]) => `'${change.elementId}'`);
        if (nonShape.length) {
            throw new McpToolError(
                `modify-nodes only accepts shape elements — got: ${nonShape.join(', ')}. ` +
                    'Use `query-elements` (inspect mode) to find shape ids, or pick the parent shape.'
            );
        }

        // Modifications are independent of each other — dispatch in parallel.
        const promises: Promise<void>[] = [];
        const warnings: string[] = [];
        elements.forEach(([change, element]) => {
            // Guaranteed non-null and shape-typed by the missing-elements / nonShape checks above.
            const resolved = element as GShapeElement;
            const { size, position, text } = change;
            const realId = this.aliasService.lookup(change.elementId);

            if (size || position) {
                const newSize = size ?? resolved.size;
                const newPosition = position ?? resolved.position;

                const operation = ChangeBoundsOperation.create([{ elementId: realId, newSize, newPosition }]);
                promises.push(this.actionDispatcher.dispatch(operation));
            }

            if (text) {
                const labelId = this.labelProvider.getLabel(resolved)?.id;
                if (labelId) {
                    promises.push(this.actionDispatcher.dispatch(ApplyLabelEditOperation.create({ labelId, text })));
                } else {
                    warnings.push(
                        `Ignored \`text\` for '${change.elementId}' (type '${resolved.type}') — this element has no editable label.`
                    );
                }
            }
        });

        await Promise.all(promises);

        const modifiedNodes = nodes
            .map(change => this.describeElement(change.elementId))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        return this.success(
            `Successfully modified ${nodes.length} node(s) (in ${promises.length} commands)` + formatNoticeList('warnings', warnings),
            { modifiedNodes, dispatchedCommands: promises.length, warnings }
        );
    }
}
