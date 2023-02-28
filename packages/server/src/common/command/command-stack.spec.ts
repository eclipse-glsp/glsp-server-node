/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as sinon from 'sinon';
import { expectToThrowAsync, StubCommand, StubLogger } from '../test/mock-util';
import { Logger } from '../utils/logger';
import { DefaultCommandStack } from './command-stack';

describe('test DefaultCommandStack', () => {
    const sandbox = sinon.createSandbox();
    const container = new Container();

    const command1 = sandbox.stub(new StubCommand());
    const command2 = sandbox.stub(new StubCommand());
    let commandStack: DefaultCommandStack;

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new StubLogger());
        })
    );
    commandStack = container.resolve(DefaultCommandStack);

    afterEach(() => {
        sandbox.reset();
        commandStack = container.resolve(DefaultCommandStack);
    });

    describe('execute', () => {
        it('should execute the given command and become dirty', async () => {
            expect(commandStack.isDirty).to.be.false;
            await commandStack.execute(command1);
            expect(command1.execute.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.true;
        });

        it('should execute the given commands in order and become dirty', async () => {
            expect(commandStack.isDirty).to.be.false;
            await commandStack.execute(command1);
            await commandStack.execute(command2);

            expect(command1.execute.calledOnce).to.be.true;
            expect(command2.execute.calledOnce).to.be.true;
            expect(command2.execute.calledAfter(command1.execute)).to.be.true;
            expect(commandStack.isDirty).to.be.true;
        });

        it('should be able to undo after execute', async () => {
            expect(commandStack.canUndo()).to.be.false;
            await commandStack.execute(command1);
            expect(commandStack.canUndo()).to.be.true;
        });

        it('should clear the redo stack after execution', async () => {
            commandStack['commands'].push(command2);
            commandStack['top'] = -1;
            expect(commandStack.canRedo()).to.be.true;

            await commandStack.execute(command1);
            expect(commandStack.canRedo()).to.be.false;
        });

        it('should flush the stack in case of an execution error', async () => {
            command2.execute.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');

            await expectToThrowAsync(() => commandStack.execute(command2));
            expect(command2.execute.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
    });

    describe('undo', () => {
        it('should do nothing if the command stack is empty', async () => {
            expect(commandStack.isDirty).to.be.false;

            await commandStack.undo();
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.isDirty).to.be.false;
        });

        it('should undo the command and become non-dirty again', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = 0;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.false;

            await commandStack.undo();
            expect(command1.undo.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.false;
        });

        it('should undo multiple command and become non-dirty again', async () => {
            commandStack['commands'].push(command1, command2);
            commandStack['top'] = 1;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.false;

            await commandStack.undo();
            expect(command2.undo.calledOnce).to.be.true;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.isDirty).to.be.true;

            await commandStack.undo();
            expect(command1.undo.calledOnce).to.be.true;
            expect(command1.undo.calledAfter(command2.undo)).to.be.true;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.false;
        });
        it('should flush the stack in case of an execution error', async () => {
            command2.undo.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');
            commandStack['commands'].push(command2);
            commandStack['top'] = 0;

            await expectToThrowAsync(() => commandStack.undo());
            expect(command2.undo.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
    });

    describe('redo', () => {
        it('should do nothing if the command stack is empty', async () => {
            expect(commandStack.isDirty).to.be.false;

            await commandStack.redo();
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.isDirty).to.be.false;
        });

        it('should redo the command and become dirty again', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = -1;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.true;

            await commandStack.redo();
            expect(command1.redo.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.canUndo()).to.be.true;
        });

        it('should undo multiple command and become non-dirty again', async () => {
            commandStack['commands'].push(command2, command1);
            commandStack['top'] = -1;
            commandStack['saveIndex'] = -1;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.true;

            await commandStack.redo();
            expect(command2.redo.calledOnce).to.be.true;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.isDirty).to.be.true;

            await commandStack.redo();
            expect(command1.redo.calledOnce).to.be.true;
            expect(command1.redo.calledAfter(command2.redo)).to.be.true;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.canUndo()).to.be.true;
        });
        it('should flush the stack in case of an execution error', async () => {
            command2.redo.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');
            commandStack['commands'].push(command2);
            commandStack['top'] = -1;

            await expectToThrowAsync(() => commandStack.redo());
            expect(command2.redo.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
        it('should be able to undo after redo', async () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = -1;
            expect(commandStack.canUndo()).to.be.false;
            await commandStack.redo();
            expect(commandStack.canUndo()).to.be.true;
        });
    });

    describe('flush', () => {
        it('should reset the internal state of the command stack', () => {
            commandStack['commands'].push(command1, command1);
            commandStack['top'] = 0;

            commandStack.flush();
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
        });
    });

    describe('isSaveDone', () => {
        it('should become non-dirty after execution', () => {
            commandStack['commands'].push(command1);
            commandStack['top'] = 0;
            expect(commandStack.isDirty).to.be.true;

            commandStack.saveIsDone();
            expect(commandStack.isDirty).to.be.false;
        });
        it('should maintain undo/redo history after execution', () => {
            commandStack['commands'].push(command1, command2);
            commandStack['top'] = 0;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.true;

            commandStack.saveIsDone();
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.true;
        });
    });
});
