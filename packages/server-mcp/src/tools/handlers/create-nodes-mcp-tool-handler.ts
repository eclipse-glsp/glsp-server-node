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

import { ApplyLabelEditOperation, CreateNodeOperation } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolResult } from '../../server/mcp-handler-shared';
import { ElementIdentity, ElementIdentitySchema, McpDiagramScopedInputSchema, position } from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';
import { formatNoticeList } from '../../util/mcp-util';

/** Single node-creation entry. Strict so an LLM-typoed field surfaces as a validation error instead of being silently dropped. */
export const CreateNodeSpecSchema = z.strictObject({
    elementTypeId: z
        .string()
        .describe('Element type ID (e.g., `task:manual`, `task:automated`). Use the `element-types` tool to discover valid IDs.'),
    position: position.describe('Position where the node should be created (absolute diagram coordinates)'),
    text: z.string().optional().describe('Label text to use in case the given element type allows for labels.'),
    containerId: z.string().optional().describe('ID of the container element. If not provided, node is added to the root.'),
    // `args` stays open (`record(...)`) — adopter-specific extension surface for per-element-type creation hints.
    args: z.record(z.string(), z.any()).optional().describe('Additional type-specific arguments for node creation (varies by element type)')
});

export const CreateNodesInputSchema = McpDiagramScopedInputSchema.extend({
    nodes: z.array(CreateNodeSpecSchema).min(1).describe('Array of nodes to create. Must include at least one node.')
});
export type CreateNodesInput = z.infer<typeof CreateNodesInputSchema>;

export const CreateNodesOutputSchema = z.object({
    createdNodes: z
        .array(ElementIdentitySchema)
        .describe('Nodes successfully created, in input order. `label` is only present when the type actually accepted text.'),
    errors: z.array(z.string()).describe('Per-input hard-failure messages — the creation could not complete.'),
    warnings: z
        .array(z.string())
        .describe(
            'Soft notices for inputs that succeeded with caveats (e.g. `text` supplied for a type whose elements have no editable label).'
        )
});

@injectable()
export class CreateNodesMcpToolHandler extends OperationMcpDiagramToolHandler<CreateNodesInput> {
    static readonly NAME = 'create-nodes';
    readonly name = CreateNodesMcpToolHandler.NAME;
    override readonly title = 'Create Diagram Nodes';
    readonly description =
        'Create one or multiple new nodes in the diagram at the specified positions. ' +
        'When creating new nodes absolutely consider the visual alignment with existing nodes — call ' +
        '`query-elements` (or `count-elements` for a quick overview) first to avoid overlap. ' +
        'Each node descriptor needs an `elementTypeId` (from `element-types`) and a `position`; ' +
        '`text`, `containerId`, and per-type `args` are optional. ' +
        'This operation modifies the diagram state and requires user approval.';
    readonly inputSchema = CreateNodesInputSchema;
    override readonly outputSchema = CreateNodesOutputSchema;

    protected async createResult({ nodes }: CreateNodesInput): Promise<McpToolResult> {
        let beforeIds = this.modelState.index.allIds();

        const errors: string[] = [];
        const warnings: string[] = [];
        const createdNodes: ElementIdentity[] = [];
        let dispatchedOperations = 0;
        // Sequential — each iteration must isolate its own creation in the post-dispatch diff.
        for (const node of nodes) {
            const { elementTypeId, position, text, args } = node;
            const containerId = node.containerId ? this.aliasService.lookup(node.containerId) : undefined;

            // Surface as `position` (matches element properties) rather than core's `location` for AI-facing API consistency.
            const operation = CreateNodeOperation.create(elementTypeId, { location: position, containerId, args });
            await this.actionDispatcher.dispatch(operation);
            dispatchedOperations++;

            const afterIds = this.modelState.index.allIds();
            const newIds = afterIds.filter(id => !beforeIds.includes(id));
            const newElements = newIds.map(id => this.modelState.index.find(id)).filter(element => element?.type === elementTypeId);
            const newElement = newElements[0];
            if (newElements.length > 1) {
                this.logger.warn('More than 1 new element created');
            }
            beforeIds = afterIds;

            // Operations don't surface failure directly — infer from absence of a new id of the requested type.
            if (!newElement) {
                errors.push(`Node creation likely failed because no new element ID was found for input: ${JSON.stringify(node)}`);
                continue;
            }

            if (text) {
                const labelId = this.labelProvider.getLabel(newElement)?.id;
                if (labelId) {
                    await this.actionDispatcher.dispatch(ApplyLabelEditOperation.create({ labelId, text }));
                    dispatchedOperations++;
                } else {
                    warnings.push(`Ignored \`text\` for '${elementTypeId}' — this element type has no editable label.`);
                }
            }

            createdNodes.push(this.describeResolvedElement(newElement));
        }

        const successListStr = createdNodes
            .map(({ id, elementTypeId, label }) => `- ${label ? `'${label}' ` : ''}${elementTypeId} (#${id})`)
            .join('\n');
        // Per-input errors / warnings are surfaced in `errors` / `warnings`; the call itself still
        // succeeds — rolling back partial creates would require operation-level transactions.
        return this.success(
            `Successfully created ${createdNodes.length} node(s) (in ${dispatchedOperations} commands):\n${successListStr}` +
                formatNoticeList('errors', errors) +
                formatNoticeList('warnings', warnings),
            { createdNodes, errors, warnings }
        );
    }
}
