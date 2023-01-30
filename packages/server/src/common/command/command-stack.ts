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
    execute(command: Command): void;

    /**
     * Removes the topmost (i.e. last executed) command from the stack and invokes {@link Command.undo}.
     */
    undo(): void;

    /**
     * Returns `true` if the top command on the stack can be undone.
     */
    canUndo(): boolean;

    /**
     * Re-adds the last undo command on top of the stack and invokes {@link Command.redo}
     */
    redo(): void;

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

    protected undoStack: Command[] = [];
    protected redoStack: Command[] = [];

    execute(command: Command): void {
        this.redoStack = [];
        try {
            command.execute();
        } catch (error) {
            this.handleError(error);
        }
        this.undoStack.push(command);
    }

    undo(): void {
        const command = this.undoStack.pop();
        if (command && Command.canUndo(command)) {
            try {
                command.undo();
            } catch (error) {
                this.handleError(error);
            }
            this.redoStack.push(command);
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0 //
            ? Command.canUndo(this.undoStack[this.undoStack.length - 1])
            : false;
    }

    redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            try {
                command.redo();
            } catch (error) {
                this.handleError(error);
            }
            this.undoStack.push(command);
        }
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    get isDirty(): boolean {
        return this.undoStack.length > 0;
    }

    saveIsDone(): void {
        this.flush();
    }

    flush(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    protected handleError(error: any): never {
        // if an error occurred during the command execution the stack might be in an erroneous state => we have to flush the command stack
        this.flush();
        this.logger.error('An error occurred during command execution. CommandStack will be flushed!', error);
        throw error;
    }
}
