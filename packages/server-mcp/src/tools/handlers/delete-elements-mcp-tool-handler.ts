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

import { DeleteElementOperation } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolResult } from '../../server/mcp-handler-shared';
import { ElementIdentitySchema, McpDiagramScopedInputSchema, elementIds } from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';

export const DeleteElementsInputSchema = McpDiagramScopedInputSchema.extend({ elementIds });
export type DeleteElementsInput = z.infer<typeof DeleteElementsInputSchema>;

export const DeleteElementsOutputSchema = z.object({
    deletedElements: z
        .array(ElementIdentitySchema)
        .describe(
            'Identity of each element the LLM requested for deletion (captured before dispatch). Dependents auto-deleted by GLSP are not enumerated here.'
        ),
    deletedCount: z
        .number()
        .int()
        .describe(
            'Total number of elements removed from the model. Higher than `deletedElements.length` when dependents (e.g. edges) are auto-deleted.'
        )
});

@injectable()
export class DeleteElementsMcpToolHandler extends OperationMcpDiagramToolHandler<DeleteElementsInput> {
    static readonly NAME = 'delete-elements';
    readonly name = DeleteElementsMcpToolHandler.NAME;
    override readonly title = 'Delete Diagram Elements';
    readonly description =
        'Delete one or more elements (nodes or edges) from the diagram. ' +
        'This operation modifies the diagram state and requires user approval. ' +
        'Automatically handles dependent elements (e.g., deleting a node also deletes connected edges).';
    readonly inputSchema = DeleteElementsInputSchema;
    override readonly outputSchema = DeleteElementsOutputSchema;
    /** Deletion is the canonical destructive update — flip the operation-base default. */
    override readonly destructiveHint = true;

    protected async createResult({ elementIds }: DeleteElementsInput): Promise<McpToolResult> {
        const realIds = this.resolveExistingIds(elementIds);
        // Capture identities BEFORE dispatch — once deleted, `describeElement` returns undefined.
        const deletedElements = realIds
            .map(realId => this.describeElement(realId))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
        const beforeCount = this.modelState.index.allIds().length;
        await this.actionDispatcher.dispatch(DeleteElementOperation.create(realIds));
        const deletedCount = beforeCount - this.modelState.index.allIds().length;
        return this.success(`Successfully deleted ${deletedCount} element(s) (including dependents)`, {
            deletedElements,
            deletedCount
        });
    }
}
