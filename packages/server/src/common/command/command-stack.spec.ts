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
import { StubCommand, StubLogger } from '../test/mock-util';
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
        it('should execute the given command and become dirty', () => {
            expect(commandStack.isDirty).to.be.false;
            commandStack.execute(command1);
            expect(command1.execute.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.true;
        });

        it('should execute the given commands in order and become dirty', () => {
            expect(commandStack.isDirty).to.be.false;
            commandStack.execute(command1);
            commandStack.execute(command2);

            expect(command1.execute.calledOnce).to.be.true;
            expect(command2.execute.calledOnce).to.be.true;
            expect(command2.execute.calledAfter(command1.execute)).to.be.true;
            expect(commandStack.isDirty).to.be.true;
        });

        it('should be able to undo after execute', () => {
            expect(commandStack.canUndo()).to.be.false;
            commandStack.execute(command1);
            expect(commandStack.canUndo()).to.be.true;
        });

        it('should clear the redo stack after execution', () => {
            commandStack['redoStack'].push(command2);
            expect(commandStack.canRedo()).to.be.true;

            commandStack.execute(command1);
            expect(commandStack.canRedo()).to.be.false;
        });

        it('should flush the stack in case of an execution error', () => {
            command2.execute.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');

            expect(() => commandStack.execute(command2)).to.throw();
            expect(command2.execute.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
    });

    describe('undo', () => {
        it('should do nothing if the command stack is empty', () => {
            expect(commandStack.isDirty).to.be.false;

            commandStack.undo();
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.isDirty).to.be.false;
        });

        it('should undo the command and become non-dirty again', () => {
            commandStack['undoStack'].push(command1);
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.false;

            commandStack.undo();
            expect(command1.undo.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.false;
        });

        it('should undo multiple command and become non-dirty again', () => {
            commandStack['undoStack'].push(command1, command2);
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.canRedo()).to.be.false;

            commandStack.undo();
            expect(command2.undo.calledOnce).to.be.true;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.isDirty).to.be.true;

            commandStack.undo();
            expect(command1.undo.calledOnce).to.be.true;
            expect(command1.undo.calledAfter(command2.undo)).to.be.true;
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.false;
        });
        it('should flush the stack in case of an execution error', () => {
            command2.undo.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');
            commandStack['undoStack'].push(command2);

            expect(() => commandStack.undo()).to.throw();
            expect(command2.undo.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
    });

    describe('redo', () => {
        it('should do nothing if the command stack is empty', () => {
            expect(commandStack.isDirty).to.be.false;

            commandStack.redo();
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.isDirty).to.be.false;
        });

        it('should redo the command and become dirty again', () => {
            commandStack['redoStack'].push(command1);
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.true;

            commandStack.redo();
            expect(command1.redo.calledOnce).to.be.true;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.canUndo()).to.be.true;
        });

        it('should undo multiple command and become non-dirty again', () => {
            commandStack['redoStack'].push(command1, command2);
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.true;

            commandStack.redo();
            expect(command2.redo.calledOnce).to.be.true;
            expect(commandStack.canRedo()).to.be.true;
            expect(commandStack.canUndo()).to.be.true;
            expect(commandStack.isDirty).to.be.true;

            commandStack.redo();
            expect(command1.redo.calledOnce).to.be.true;
            expect(command1.redo.calledAfter(command2.redo)).to.be.true;
            expect(commandStack.isDirty).to.be.true;
            expect(commandStack.canRedo()).to.be.false;
            expect(commandStack.canUndo()).to.be.true;
        });
        it('should flush the stack in case of an execution error', () => {
            command2.redo.throwsException();
            const flushSpy = sandbox.spy(commandStack, 'flush');
            commandStack['redoStack'].push(command2);

            expect(() => commandStack.redo()).to.throw();
            expect(command2.redo.calledOnce).to.be.true;
            expect(flushSpy.calledOnce).to.be.true;
        });
        it('should be able to undo after redo', () => {
            commandStack['redoStack'].push(command1);
            expect(commandStack.canUndo()).to.be.false;
            commandStack.redo();
            expect(commandStack.canUndo()).to.be.true;
        });
    });

    describe('flush', () => {
        it('should reset the internal state of the command stack', () => {
            commandStack['undoStack'].push(command1);
            commandStack['redoStack'].push(command1);

            commandStack.flush();
            expect(commandStack.isDirty).to.be.false;
            expect(commandStack.canUndo()).to.be.false;
            expect(commandStack.canRedo()).to.be.false;
        });
    });
});
