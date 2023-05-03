/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
import { MaybePromise } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { Logger } from '../utils/logger';
import { Command } from './command';

export const CommandStack = Symbol('CommandStack');

/**
 * A command stack keeps track of {@link Command commands} that have been executed.
 * Executed commands can be undone in the reverse order of their original execution.
 * Unless a new command has been executed after an undo operation, commands can be
 * redone in the original order of their execution.
 *
 */
export interface CommandStack {
    /**
     * Clears any redoable commands not yet redone, adds the command to the stack and then invokes {@link Command.execute}.
     * @param command the command to execute.
     */
    execute(command: Command): MaybePromise<void>;

    /**
     * Removes the topmost (i.e. last executed) command from the stack and invokes {@link Command.undo}.
     */
    undo(): MaybePromise<void>;

    /**
     * Returns `true` if the top command on the stack can be undone.
     */
    canUndo(): boolean;

    /**
     * Re-adds the last undo command on top of the stack and invokes {@link Command.redo}
     */
    redo(): MaybePromise<void>;

    /**
     * Returns `true` if there are  redoable commands in the stack.
     */
    canRedo(): boolean;

    /**
     * Called after a save has been successfully performed.
     */
    saveIsDone(): void;

    /**
     * Indicates wether the command stack has unsaved changes.
     */
    readonly isDirty: boolean;

    /**
     * Disposes all the commands in the stack.
     */
    flush(): void;
}

@injectable()
export class DefaultCommandStack implements CommandStack {
    @inject(Logger)
    protected logger: Logger;

    protected commands: Command[] = [];

    /**
     * The current position within the command list from which the next execute, undo, or redo, will be performed.
     */
    protected top = -1;

    /**
     * The current position within the command list when {@link DefaultCommandStack.saveIsDone} is called.
     */
    protected saveIndex = -1;

    async execute(command: Command): Promise<void> {
        try {
            await command.execute();
        } catch (error) {
            this.handleError(error);
        }
        // Clear the command list past the top (i.e. the old redo list)
        this.commands = this.commands.slice(0, this.top + 1);
        this.commands.push(command);
        ++this.top;

        // if the saveIndex points to the old redo list we can never reach a state again
        // where save is not necessary. => ensure that `isDirty` always returns true
        if (this.saveIndex >= this.top) {
            this.saveIndex = -2;
        }
    }

    async undo(): Promise<void> {
        if (this.canUndo()) {
            const command = this.commands[this.top--];
            try {
                await command.undo();
            } catch (error) {
                this.handleError(error);
            }
        }
    }

    canUndo(): boolean {
        return this.top !== -1 //
            ? Command.canUndo(this.commands[this.top])
            : false;
    }

    async redo(): Promise<void> {
        if (this.canRedo()) {
            const command = this.commands[++this.top];
            try {
                await command.redo();
            } catch (error) {
                this.handleError(error);
            }
        }
    }

    canRedo(): boolean {
        return this.top < this.commands.length - 1;
    }

    get isDirty(): boolean {
        return this.saveIndex !== this.top;
    }

    saveIsDone(): void {
        this.saveIndex = this.top;
    }

    flush(): void {
        this.commands = [];
        this.top = -1;
        this.saveIndex = -1;
    }

    protected handleError(error: any): never {
        // if an error occurred during the command execution the stack might be in an erroneous state => we have to flush the command stack
        this.flush();
        this.logger.error('An error occurred during command execution. CommandStack will be flushed!', error);
        throw error;
    }
}
