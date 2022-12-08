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

/**
 * Commands can execute arbitrary code actions in a revertible fashion.
 * To achieve this each command is executed on a {@link CommandStack}. In addition, a command
 * provides `undo` and `redo` functionality that allow the command stack to undo/redo the effect of a previously executed command.
 *
 * Each command is self contained and stores all the information it needs to execute, undo or redo itself.
 *
 * In theory commands can be used to execute any code actions.
 * However, it is mostly used to record and manage changes made to the source model via GLSP operations.
 */
export interface Command {
    /**
     * Performs the command activity required for the effect (e.g. source model change).
     */
    execute(): void;

    /**
     * Performs the command activity required to `undo` the effects of a preceding `execute` (or `redo`).
     * The effect, if any, of calling `undo` before `execute` or `redo` have been called, is undefined.
     */
    undo(): void;

    /**
     * Performs the command activity required to `redo` the effect after undoing the effect.
     * The effect, if any, of calling `redo` before `undo` is called is undefined.
     */
    redo(): void;

    /**
     * Returns whether the command can be undone.
     * This function is optional. If not implemented, it is assumed that the command can be undone.
     * @returns whether the command can be undone
     */
    canUndo?(): boolean;
}
