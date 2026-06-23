/********************************************************************************
 * Copyright (c) 2023-2026 EclipseSource and others.
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
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Command, CompoundCommand } from './command';

// Note: `canUndo` is intentionally left undefined (it is optional on `Command`). `Command.canUndo`
// returns `command.canUndo?.() ?? true`, so an absent `canUndo` counts as "can undo" — matching the
// original `StubCommand` (whose optional `canUndo` was never implemented).
function makeStubCommand(): Command & {
    execute: Mock<Command['execute']>;
    undo: Mock<Command['undo']>;
    redo: Mock<Command['redo']>;
} {
    return {
        execute: vi.fn<Command['execute']>(),
        undo: vi.fn<Command['undo']>(),
        redo: vi.fn<Command['redo']>()
    };
}

describe('CompoundCommand', () => {
    let command1: ReturnType<typeof makeStubCommand>;
    let command2: ReturnType<typeof makeStubCommand>;
    let command3: ReturnType<typeof makeStubCommand>;
    let compoundCommand: CompoundCommand;

    beforeEach(() => {
        command1 = makeStubCommand();
        command2 = makeStubCommand();
        command3 = makeStubCommand();
        compoundCommand = new CompoundCommand(command1, command2, command3);
    });

    describe('execute', () => {
        it('Should execute the subcommands in order', async () => {
            await compoundCommand.execute();
            expect(command1.execute).toHaveBeenCalledOnce();
            expect(command2.execute).toHaveBeenCalledOnce();
            expect(command3.execute).toHaveBeenCalledOnce();
            expect(command1.execute.mock.invocationCallOrder[0]).toBeLessThan(command2.execute.mock.invocationCallOrder[0]);
            expect(command2.execute.mock.invocationCallOrder[0]).toBeLessThan(command3.execute.mock.invocationCallOrder[0]);
        });
        it('Should undo partially executed subcommands in  case of an error', async () => {
            command3.execute.mockImplementation(() => {
                throw new Error('error');
            });

            await expect(compoundCommand.execute()).rejects.toThrow();

            expect(command1.execute).toHaveBeenCalledOnce();
            expect(command2.execute).toHaveBeenCalledOnce();
            expect(command3.execute).toHaveBeenCalledOnce();
            expect(command1.undo).toHaveBeenCalledOnce();
            expect(command2.undo).toHaveBeenCalledOnce();
        });
    });

    describe('undo', () => {
        it('Should undo the subcommands in reverse order', async () => {
            await compoundCommand.undo();
            expect(command1.undo).toHaveBeenCalledOnce();
            expect(command2.undo).toHaveBeenCalledOnce();
            expect(command3.undo).toHaveBeenCalledOnce();
            expect(command1.undo.mock.invocationCallOrder[0]).toBeGreaterThan(command2.undo.mock.invocationCallOrder[0]);
            expect(command2.undo.mock.invocationCallOrder[0]).toBeGreaterThan(command3.undo.mock.invocationCallOrder[0]);
        });

        it('Should redo partially undone subcommands in  case of an error', async () => {
            command1.undo.mockImplementation(() => {
                throw new Error('error');
            });
            await expect(compoundCommand.undo()).rejects.toThrow();

            expect(command1.undo).toHaveBeenCalledOnce();
            expect(command2.undo).toHaveBeenCalledOnce();
            expect(command3.undo).toHaveBeenCalledOnce();
            expect(command3.redo).toHaveBeenCalledOnce();
            expect(command2.redo).toHaveBeenCalledOnce();
        });
    });

    describe('canUndo', () => {
        it('should return true if all subcommands can be undone', () => {
            expect(compoundCommand.canUndo()).toBe(true);
        });
        it('should return false if any of the subcommands cannot be undone', () => {
            command2.canUndo = vi.fn<NonNullable<Command['canUndo']>>().mockReturnValue(false);
            expect(compoundCommand.canUndo()).toBe(false);
        });
    });
});
