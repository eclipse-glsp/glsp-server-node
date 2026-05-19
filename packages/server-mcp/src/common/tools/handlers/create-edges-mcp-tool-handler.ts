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

import { ChangeRoutingPointsOperation, CreateEdgeOperation, DiagramConfiguration, EdgeCreationChecker } from '@eclipse-glsp/server';
import { inject, injectable, optional } from 'inversify';
import * as z from 'zod/v4';
import { McpToolResult } from '../../server/mcp-handler-shared';
import {
    ElementIdentity,
    ElementIdentitySchema,
    McpDiagramScopedInputSchema,
    dispatchedCommands,
    position
} from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';
import { formatNoticeList } from '../../util/mcp-util';

/** Single edge-creation entry. Strict so an LLM-typoed field surfaces as a validation error instead of being silently dropped. */
export const CreateEdgeSpecSchema = z.strictObject({
    elementTypeId: z.string().describe('Edge type ID (e.g., `edge`, `transition`). Use the `element-types` tool to discover valid IDs.'),
    sourceElementId: z.string().describe('ID of the source element (must exist in the diagram)'),
    targetElementId: z.string().describe('ID of the target element (must exist in the diagram)'),
    routingPoints: z.array(position).optional().describe('Optional array of routing point coordinates that allow for a complex edge path.'),
    // `args` stays open (`record(...)`) — adopter-specific extension surface for per-edge-type creation hints.
    args: z.record(z.string(), z.any()).optional().describe('Additional type-specific arguments for edge creation (varies by edge type)')
});

export const CreateEdgesInputSchema = McpDiagramScopedInputSchema.extend({
    edges: z.array(CreateEdgeSpecSchema).min(1).describe('Array of edges to create. Must include at least one edge.'),
    dryRun: z
        .boolean()
        .optional()
        .describe(
            'When true, validate each edge against the type-hint rules without creating anything; returns per-edge `validationResults`.'
        )
});
export type CreateEdgesInput = z.infer<typeof CreateEdgesInputSchema>;

export const CreateEdgesValidationResultSchema = z.object({
    edgeType: z.string(),
    sourceElementId: z.string(),
    targetElementId: z.string(),
    isValid: z.boolean(),
    reason: z.string().optional().describe('Brief reason explaining the verdict (always present when `isValid: false`).')
});

export const CreateEdgesOutputSchema = z.object({
    createdEdges: z.array(ElementIdentitySchema).describe('Identity of each edge successfully created. Empty in `dryRun` mode.'),
    dispatchedCommands,
    errors: z.array(z.string()).describe('Per-input failure messages; absent or empty when every input succeeded.'),
    validationResults: z
        .array(CreateEdgesValidationResultSchema)
        .optional()
        .describe('Per-input validation results. Present only in `dryRun` mode.')
});

type EdgeInput = CreateEdgesInput['edges'][number];
type ValidationResult = z.infer<typeof CreateEdgesValidationResultSchema>;

@injectable()
export class CreateEdgesMcpToolHandler extends OperationMcpDiagramToolHandler<CreateEdgesInput> {
    static readonly NAME = 'create-edges';
    readonly name = CreateEdgesMcpToolHandler.NAME;
    override readonly title = 'Create Diagram Edges';
    readonly description =
        'Create one or multiple new edges connecting two elements in the diagram. ' +
        'Set `dryRun: true` to validate proposed edges (per the diagram-type type-hint rules) ' +
        'without creating anything; the result then carries per-edge `validationResults`. ' +
        'Without `dryRun`, this operation modifies the diagram state and requires user approval. ' +
        'Use the `element-types` tool to discover valid edge type IDs.';
    readonly inputSchema = CreateEdgesInputSchema;
    override readonly outputSchema = CreateEdgesOutputSchema;

    @inject(DiagramConfiguration) protected diagramConfiguration: DiagramConfiguration;
    @inject(EdgeCreationChecker) @optional() protected edgeCreationChecker?: EdgeCreationChecker;

    protected async createResult({ edges, dryRun }: CreateEdgesInput): Promise<McpToolResult> {
        if (dryRun) {
            return this.runDryRun(edges);
        }
        return this.runCreate(edges);
    }

    protected runDryRun(edges: EdgeInput[]): McpToolResult {
        const validationResults: ValidationResult[] = edges.map(edge => this.validateEdge(edge));
        const validCount = validationResults.filter(result => result.isValid).length;
        const summary =
            `Dry run: validated ${edges.length} edge(s); ${validCount} would be accepted, ${edges.length - validCount} rejected.\n` +
            validationResults
                .map(
                    result =>
                        `- ${result.edgeType} ${result.sourceElementId} → ${result.targetElementId}: ` +
                        `${result.isValid ? 'valid' : `invalid (${result.reason})`}`
                )
                .join('\n');
        return this.success(summary, { createdEdges: [], errors: [], validationResults });
    }

    protected async runCreate(edges: EdgeInput[]): Promise<McpToolResult> {
        let beforeIds = this.modelState.index.allIds();

        const errors: string[] = [];
        const createdEdges: ElementIdentity[] = [];
        let dispatchedOperations = 0;
        // Sequential — each iteration must isolate its own creation in the post-dispatch diff.
        for (const edge of edges) {
            const { elementTypeId, routingPoints, args } = edge;
            const sourceElementId = this.aliasService.lookup(edge.sourceElementId);
            const targetElementId = this.aliasService.lookup(edge.targetElementId);

            const source = this.modelState.index.find(sourceElementId);
            if (!source) {
                errors.push(`Source element not found: ${edge.sourceElementId}`);
                continue;
            }
            const target = this.modelState.index.find(targetElementId);
            if (!target) {
                errors.push(`Target element not found: ${edge.targetElementId}`);
                continue;
            }

            const operation = CreateEdgeOperation.create({ elementTypeId, sourceElementId, targetElementId, args });
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
                errors.push(`Edge creation likely failed because no new element ID was found for input: ${JSON.stringify(edge)}`);
                continue;
            }

            if (routingPoints) {
                const routingPointsOperation = ChangeRoutingPointsOperation.create([
                    { elementId: newElement.id, newRoutingPoints: routingPoints }
                ]);
                await this.actionDispatcher.dispatch(routingPointsOperation);
                dispatchedOperations++;
            }

            createdEdges.push(this.describeResolvedElement(newElement));
        }

        const successListStr = createdEdges.map(({ id, elementTypeId }) => `- ${elementTypeId} (#${id})`).join('\n');
        // Per-input errors are surfaced in `errors`; the call itself still succeeds — rolling back partial creates would require operation-level transactions.
        return this.success(
            `Successfully created ${createdEdges.length} edge(s) (in ${dispatchedOperations} commands):\n${successListStr}${formatNoticeList('errors', errors)}`,
            { createdEdges, dispatchedCommands: dispatchedOperations, errors }
        );
    }

    /** Mirrors `RequestCheckEdgeAction`: existence check, then dynamic-hint → checker; static or unknown edgeType → valid. */
    protected validateEdge(edge: EdgeInput): ValidationResult {
        const { elementTypeId } = edge;
        const sourceRealId = this.aliasService.lookup(edge.sourceElementId);
        const targetRealId = this.aliasService.lookup(edge.targetElementId);
        const echo: Pick<ValidationResult, 'edgeType' | 'sourceElementId' | 'targetElementId'> = {
            edgeType: elementTypeId,
            sourceElementId: edge.sourceElementId,
            targetElementId: edge.targetElementId
        };

        const source = this.modelState.index.find(sourceRealId);
        if (!source) {
            return { ...echo, isValid: false, reason: `Source element not found: ${edge.sourceElementId}` };
        }
        const target = this.modelState.index.find(targetRealId);
        if (!target) {
            return { ...echo, isValid: false, reason: `Target element not found: ${edge.targetElementId}` };
        }

        const hasDynamicHint = this.diagramConfiguration.edgeTypeHints.some(hint => hint.elementTypeId === elementTypeId && hint.dynamic);
        if (!hasDynamicHint) {
            return { ...echo, isValid: true, reason: 'no dynamic edge-type hint — static hints apply' };
        }
        if (!this.edgeCreationChecker) {
            return {
                ...echo,
                isValid: false,
                reason: `EdgeCreationChecker is not bound although edge type '${elementTypeId}' declares a dynamic hint.`
            };
        }
        const isValid = this.edgeCreationChecker.isValidTarget(elementTypeId, source, target);
        return { ...echo, isValid, ...(isValid ? {} : { reason: 'rejected by EdgeCreationChecker' }) };
    }
}
