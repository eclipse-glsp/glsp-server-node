/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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
import { injectable } from 'inversify';
import { Command } from './command';

export const CommandStack = Symbol('CommandStack');

/**
 * A basic implementation of an undoable stack of commands.
 * See {@link Command} for more details about the command methods that this implementation uses.
 */
export interface CommandStack {
    /**
     * Clears any redoable commands not yet redone, adds the command, and then executes the command.
     * @param command the command to execute.
     */
    execute(command: Command): void;

    /**
     * Moves the top of the stack down, undoing what was formerly the top command.
     */
    undo(): void;

    /**
     * Moves the top of the stack up, redoing the new top command.
     */
    redo(): void;

    /**
     * The command stack has currently unsaved changes.
     */
    isDirty(): boolean;

    /**
     * Called after a save has been successfully performed.
     */
    saveIsDone(): void;
}

@injectable()
export class DefaultCommandStack implements CommandStack {
    execute(command: Command): void {
        // no-op
    }

    undo(): void {
        // no-op
    }

    redo(): void {
        // no-op
    }

    isDirty(): boolean {
        return false;
    }

    saveIsDone(): void {
        // no-op
    }
}
