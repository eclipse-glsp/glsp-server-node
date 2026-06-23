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
import { Container, ContainerModule } from 'inversify';
import { StubLogger } from '../test/mock-util';
import { Command } from '../command/command';
import { Logger } from '../utils/logger';
import { DefaultCommandStack } from './command-stack';

function makeStubCommand(): Command & {
    execute: Mock<Command['execute']>;
    undo: Mock<Command['undo']>;
    redo: Mock<Command['redo']>;
    canUndo: Mock<NonNullable<Command['canUndo']>>;
} {
    return {
        execute: vi.fn<Command['execute']>(),
        undo: vi.fn<Command['undo']>(),
        redo: vi.fn<Command['redo']>(),
        canUndo: vi.fn<NonNullable<Command['canUndo']>>()
    };
}

describe('test DefaultCommandStack', () => {
    const container = new Container();

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new StubLogger());
        })
    );

    let command1: ReturnType<typeof makeStubCommand>;
    let command2: ReturnType<typeof makeStubCommand>;
    let commandStack: DefaultCommandStack;

    beforeEach(() => {
        command1 = makeStubCommand();
        command2 = makeStubCommand();
        commandStack = container.resolve(DefaultCommandStack);
    });

    describe('execute', () => {
        it('should execute the given command and become dirty', async () => {
            expect(commandStack.isDirty).toBe(false);
            await commandStack.execute(command1);
            expect(command1.execute).toHaveBeenCalledOnce();
            expect(commandStack.isDirty).toBe(true);
        });

        it('should execute the given commands in order and become dirty', async () => {
            expect(commandStack.isDirty).toBe(false);
            await commandStack.execute(command1);
            await commandStack.execute(command2);

            expect(command1.execute).toHaveBeenCalledOnce();
            expect(command2.execute).toHaveBeenCalledOnce();
            expect(command2.execute.mock.invocationCallOrder[0]).toBeGreaterThan(command1.execute.mock.invocationCallOrder[0]);
            expect(commandStack.isDirty).toBe(true);
        });

        it('should be able to undo after execute', async () => {
            expect(commandStack.canUndo()).toBe(false);
            await commandStack.execute(command1);
            expect(commandStack.canUndo()).toBe(true);
        });

        it('should clear the redo stack after execution', async () => {
            commandStack['commands'].push(command2);
            commandStack['top'] = -1;
            expect(commandStack.canRedo()).toBe(true);

            await commandStack.execute(command1);
            expect(commandStack.canRedo()).toBe(false);
        });

        it('should flush the stack in case of an execution error', async () => {
            command2.execute.mockImplementation(() => {
                throw new Error('error');
            });
            const flushSpy = vi.spyOn(commandStack, 'flush');

            await expect(commandStack.execute(command2)).rejects.toThrow();
            expect(command2.execute).toHaveBeenCalledOnce();
            expect(flushSpy).toHaveBeenCalledOnce();
        });
    });

    describe('undo', () => {
        it('should do nothing if the command stack is empty', async () => {
            expect(commandStack.isDirty).toBe(false);

            await commandStack.undo();
            expect(commandStack.canUndo()).toBe(false);
            expect(commandStack.canRedo()).toBe(false);
            expect(commandStack.isDirty).toBe(false);
        });

        it('should undo the command and become non-dirty again', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = 0;
            expect(commandStack.isDirty).toBe(true);
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.canRedo()).toBe(false);

            await commandStack.undo();
            expect(command1.undo).toHaveBeenCalledOnce();
            expect(commandStack.isDirty).toBe(false);
            expect(commandStack.canRedo()).toBe(true);
            expect(commandStack.canUndo()).toBe(false);
        });

        it('should undo multiple command and become non-dirty again', async () => {
            commandStack['commands'].push(command1, command2);
            commandStack['top'] = 1;
            expect(commandStack.isDirty).toBe(true);
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.canRedo()).toBe(false);

            await commandStack.undo();
            expect(command2.undo).toHaveBeenCalledOnce();
            expect(commandStack.canRedo()).toBe(true);
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.isDirty).toBe(true);

            await commandStack.undo();
            expect(command1.undo).toHaveBeenCalledOnce();
            expect(command1.undo.mock.invocationCallOrder[0]).toBeGreaterThan(command2.undo.mock.invocationCallOrder[0]);
            expect(commandStack.isDirty).toBe(false);
            expect(commandStack.canRedo()).toBe(true);
            expect(commandStack.canUndo()).toBe(false);
        });
        it('should flush the stack in case of an execution error', async () => {
            command2.undo.mockImplementation(() => {
                throw new Error('error');
            });
            const flushSpy = vi.spyOn(commandStack, 'flush');
            commandStack['commands'].push(command2);
            commandStack['top'] = 0;

            await expect(commandStack.undo()).rejects.toThrow();
            expect(command2.undo).toHaveBeenCalledOnce();
            expect(flushSpy).toHaveBeenCalledOnce();
        });
    });

    describe('redo', () => {
        it('should do nothing if the command stack is empty', async () => {
            expect(commandStack.isDirty).toBe(false);

            await commandStack.redo();
            expect(commandStack.canUndo()).toBe(false);
            expect(commandStack.canRedo()).toBe(false);
            expect(commandStack.isDirty).toBe(false);
        });

        it('should redo the command and become dirty again', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = -1;
            expect(commandStack.isDirty).toBe(false);
            expect(commandStack.canUndo()).toBe(false);
            expect(commandStack.canRedo()).toBe(true);

            await commandStack.redo();
            expect(command1.redo).toHaveBeenCalledOnce();
            expect(commandStack.isDirty).toBe(true);
            expect(commandStack.canRedo()).toBe(false);
            expect(commandStack.canUndo()).toBe(true);
        });

        it('should undo multiple command and become non-dirty again', async () => {
            commandStack['commands'].push(command2, command1);
            commandStack['top'] = -1;
            commandStack['saveIndex'] = -1;
            expect(commandStack.isDirty).toBe(false);
            expect(commandStack.canUndo()).toBe(false);
            expect(commandStack.canRedo()).toBe(true);

            await commandStack.redo();
            expect(command2.redo).toHaveBeenCalledOnce();
            expect(commandStack.canRedo()).toBe(true);
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.isDirty).toBe(true);

            await commandStack.redo();
            expect(command1.redo).toHaveBeenCalledOnce();
            expect(command1.redo.mock.invocationCallOrder[0]).toBeGreaterThan(command2.redo.mock.invocationCallOrder[0]);
            expect(commandStack.isDirty).toBe(true);
            expect(commandStack.canRedo()).toBe(false);
            expect(commandStack.canUndo()).toBe(true);
        });
        it('should flush the stack in case of an execution error', async () => {
            command2.redo.mockImplementation(() => {
                throw new Error('error');
            });
            const flushSpy = vi.spyOn(commandStack, 'flush');
            commandStack['commands'].push(command2);
            commandStack['top'] = -1;

            await expect(commandStack.redo()).rejects.toThrow();
            expect(command2.redo).toHaveBeenCalledOnce();
            expect(flushSpy).toHaveBeenCalledOnce();
        });
        it('should be able to undo after redo', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = -1;
            expect(commandStack.canUndo()).toBe(false);
            await commandStack.redo();
            expect(commandStack.canUndo()).toBe(true);
        });
    });

    describe('flush', () => {
        it('should reset the internal state of the command stack', () => {
            commandStack['commands'].push(command1, command1);
            commandStack['top'] = 0;

            commandStack.flush();
            expect(commandStack.isDirty).toBe(false);
            expect(commandStack.canUndo()).toBe(false);
            expect(commandStack.canRedo()).toBe(false);
        });
    });

    describe('isSaveDone', () => {
        it('should become non-dirty after execution', () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = 0;
            expect(commandStack.isDirty).toBe(true);

            commandStack.saveIsDone();
            expect(commandStack.isDirty).toBe(false);
        });
        it('should maintain undo/redo history after execution', () => {
            commandStack['commands'].push(command1, command2);
            commandStack['top'] = 0;
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.canRedo()).toBe(true);

            commandStack.saveIsDone();
            expect(commandStack.canUndo()).toBe(true);
            expect(commandStack.canRedo()).toBe(true);
        });
    });
});
