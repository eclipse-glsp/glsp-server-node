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
 * An interface that every command is expected to support.
 * A command can be executed, it can be undone, and can then be redone.
 */
export interface Command {
    /**
     * Performs the command activity required for the effect.
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
     * Note that if you implement `redo` to call `execute` then any derived class will be restricted by that decision also.
     */
    redo(): void;
}
