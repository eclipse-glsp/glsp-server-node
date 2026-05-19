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

import { CommandStack, RedoAction } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpToolError, McpToolResult } from '../../server/mcp-handler-shared';
import { McpDiagramScopedInputSchema } from '../../server/mcp-input-schemas';
import { OperationMcpDiagramToolHandler } from '../../server/mcp-tool-handler';

export const RedoInputSchema = McpDiagramScopedInputSchema.extend({
    commandsToRedo: z.number().min(1).default(1).describe('Number of commands to redo. Defaults to 1 (most recent undone command).')
});
export type RedoInput = z.infer<typeof RedoInputSchema>;

export const RedoOutputSchema = z.object({
    commandsRedone: z.number().int().describe('Number of previously-undone commands re-applied.')
});

/**
 * Redo a given number of the most recent undone actions on the command stack.
 */
@injectable()
export class RedoMcpToolHandler extends OperationMcpDiagramToolHandler<RedoInput> {
    static readonly NAME = 'redo';
    readonly name = RedoMcpToolHandler.NAME;
    override readonly title = 'Redo Diagram Commands';
    readonly description =
        'Re-apply commands that were previously undone. Defaults to redoing one command — the most recent undo — when ' +
        '`commandsToRedo` is omitted. Use the same count you passed to `undo` to revert a complete undo cycle. ' +
        "Throws when there's nothing on the redo stack (e.g. nothing has been undone, or the redo stack was cleared by a " +
        'subsequent edit). Only do this on an explicit user request.';
    readonly inputSchema = RedoInputSchema;
    override readonly outputSchema = RedoOutputSchema;

    @inject(CommandStack) protected commandStack: CommandStack;

    protected async createResult({ commandsToRedo }: RedoInput): Promise<McpToolResult> {
        if (!this.commandStack.canRedo()) {
            throw new McpToolError(
                'Nothing to redo (redo stack is empty; perform an undo first or accept that the redo history was cleared by a subsequent edit).'
            );
        }

        for (let i = 0; i < commandsToRedo; i++) {
            await this.actionDispatcher.dispatch(RedoAction.create());
        }

        return this.success('Redo successful', { commandsRedone: commandsToRedo });
    }
}
