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

import { CommandStack, UndoAction } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpDiagramScopedInputSchema, McpToolError, McpToolResult, OperationMcpDiagramToolHandler } from '../../server';

export const UndoInputSchema = McpDiagramScopedInputSchema.extend({
    commandsToUndo: z.number().min(1).default(1).describe('Number of commands to undo. Defaults to 1 (most recent command).')
});
export type UndoInput = z.infer<typeof UndoInputSchema>;

export const UndoOutputSchema = z.object({
    commandsUndone: z.number().int().describe('Number of commands actually reverted.')
});

/**
 * Undo a given number of the most recent actions on the command stack.
 */
@injectable()
export class UndoMcpToolHandler extends OperationMcpDiagramToolHandler<UndoInput> {
    static readonly NAME = 'undo';
    readonly name = UndoMcpToolHandler.NAME;
    override readonly title = 'Undo Diagram Commands';
    readonly description =
        "Undo recent commands on the diagram's command stack. " +
        'Defaults to undoing one command — the most recent operation — when `commandsToUndo` is omitted. ' +
        'Note that some tools dispatch multiple commands per call (e.g. `create-nodes` typically dispatches a node + a label command); ' +
        'check the previous tool result for the exact count if you need to reverse more than the last one. ' +
        "Throws when there's nothing on the undo stack. Only do this on an explicit user request.";
    readonly inputSchema = UndoInputSchema;
    override readonly outputSchema = UndoOutputSchema;

    @inject(CommandStack) protected commandStack: CommandStack;

    protected async createResult({ commandsToUndo }: UndoInput): Promise<McpToolResult> {
        if (!this.commandStack.canUndo()) {
            throw new McpToolError('Nothing to undo (undo stack is empty; the model is at its initial state for this session).');
        }

        for (let i = 0; i < commandsToUndo; i++) {
            await this.actionDispatcher.dispatch(UndoAction.create());
        }

        return this.success('Undo successful', { commandsUndone: commandsToUndo });
    }
}
