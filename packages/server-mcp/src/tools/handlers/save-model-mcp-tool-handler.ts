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

import { ActionDispatcher, CommandStack, SaveModelAction } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpDiagramScopedInputSchema, AbstractMcpDiagramToolHandler, McpLogger, McpToolResult } from '../../server';

export const SaveModelInputSchema = McpDiagramScopedInputSchema.extend({
    fileUri: z.string().optional().describe('Optional destination file URI. If not provided, saves to the original source model location.')
});
export type SaveModelInput = z.infer<typeof SaveModelInputSchema>;

export const SaveModelOutputSchema = z.object({
    saved: z.boolean().describe('True when a save operation was dispatched; false when the model was clean and nothing was written.'),
    fileUri: z
        .string()
        .optional()
        .describe('Destination file URI when explicitly provided; absent when saving to the original source location.')
});

/** Doesn't extend `OperationMcpDiagramToolHandler` — saving a read-only model is a legitimate adopter scenario (e.g. "save as" to a writable location). */
@injectable()
export class SaveModelMcpToolHandler extends AbstractMcpDiagramToolHandler<SaveModelInput> {
    static readonly NAME = 'save-model';
    readonly name = SaveModelMcpToolHandler.NAME;
    override readonly title = 'Save Diagram Model';
    readonly description =
        'Save the current diagram model to persistent storage. ' +
        'This operation persists all changes back to the source model. ' +
        'Only do this on an explicit user request and not as part of other tasks. ' +
        'Optionally specify a new fileUri to save to a different location.';
    readonly inputSchema = SaveModelInputSchema;
    override readonly outputSchema = SaveModelOutputSchema;
    /**
     * Saving writes to disk — that's a mutation of the environment even though the in-memory
     * model state isn't a target of an `Operation` dispatch. Drop the readOnly claim from the
     * read-base default. Not destructive per the spec definition (no irreversible deletion).
     */
    override readonly readOnlyHint = false;
    override readonly destructiveHint: boolean = false;
    override readonly idempotentHint: boolean = false;

    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;
    @inject(CommandStack) protected commandStack: CommandStack;
    @inject(McpLogger) protected mcpLogger: McpLogger;

    protected async createResult({ fileUri }: SaveModelInput): Promise<McpToolResult> {
        if (!this.commandStack.isDirty) {
            this.mcpLogger.info('save-model: nothing to save');
            return this.success('No changes to save', { saved: false, fileUri });
        }

        await this.actionDispatcher.dispatch(SaveModelAction.create({ fileUri }));
        this.mcpLogger.info(`save-model: model saved${fileUri ? ` to ${fileUri}` : ''}`);
        return this.success('Model saved successfully', { saved: true, fileUri });
    }
}
