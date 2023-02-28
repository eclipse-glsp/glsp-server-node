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

import { flatPush, MaybeArray, MaybePromise } from '@eclipse-glsp/protocol';

/**
 * A command implements a specific modification of the source model, which can be applied by invoking `execute()`.
 * Commands may also provide implementations to `undo()` and `redo()` the effect they had.
 * To maintain an order in which commands can be undone and redone, they are managed in the context of a {@link CommandStack}.
 *
 * Each command is self contained and stores all the information it needs to execute, undo or redo itself.
 *
 * In theory commands can be used to execute arbitrary activities and not only modify the source model.
 * However, it is mostly used to record and manage changes made to the source model via GLSP operations.
 */
export interface Command {
    /**
     * Performs the command activity required for the effect (e.g. source model change).
     */
    execute(): MaybePromise<void>;

    /**
     * Performs the command activity required to `undo` the effects of a preceding `execute` (or `redo`).
     * The effect, if any, of calling `undo` before `execute` or `redo` have been called, is undefined.
     */
    undo(): MaybePromise<void>;

    /**
     * Performs the command activity required to `redo` the effect after undoing the effect.
     * The effect, if any, of calling `redo` before `undo` is called is undefined.
     */
    redo(): MaybePromise<void>;

    /**
     * Returns whether the command can be undone.
     * This function is optional. If not implemented, it is assumed that the command can be undone.
     * @returns whether the command can be undone
     */
    canUndo?(): boolean;
}

export namespace Command {
    export function canUndo(command: Command): boolean {
        return command.canUndo?.() ?? true;
    }
}

/**
 * A command that comprises a sequence of subcommands.
 */
export class CompoundCommand implements Command {
    protected readonly commands: Command[];

    constructor(commands: Command[]);
    constructor(...commands: Command[]);
    constructor(...commands: MaybeArray<Command>[]) {
        this.commands = [];
        flatPush(this.commands, commands);
    }

    async execute(): Promise<void> {
        const alreadyExecuted: Command[] = [];

        try {
            for (const command of this.commands) {
                await command.execute();
                alreadyExecuted.unshift(command);
            }
        } catch (err) {
            for (const command of alreadyExecuted) {
                if (Command.canUndo(command)) {
                    await command.undo();
                } else {
                    break;
                }
            }
            throw err;
        }
    }

    async undo(): Promise<void> {
        const alreadyUndone: Command[] = [];
        try {
            for (const command of [...this.commands].reverse()) {
                await command.undo();
                alreadyUndone.unshift(command);
            }
        } catch (err) {
            for (const command of alreadyUndone) {
                await command.redo();
            }
            throw err;
        }
    }

    async redo(): Promise<void> {
        const alreadyRedone: Command[] = [];

        try {
            for (const command of this.commands) {
                await command.redo();
                alreadyRedone.unshift(command);
            }
        } catch (err) {
            for (const command of alreadyRedone) {
                await command.undo();
            }
            throw err;
        }
    }

    canUndo(): boolean {
        return this.commands.every(Command.canUndo);
    }
}
