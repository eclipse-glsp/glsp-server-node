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
import * as sinon from 'sinon';
import { StubCommand } from '../test/mock-util';
import { CompoundCommand } from './command';

describe('CompoundCommand', () => {
    const sandbox = sinon.createSandbox();

    const command1 = sandbox.stub(new StubCommand());
    const command2 = sandbox.stub(new StubCommand());
    const command3 = sandbox.stub(new StubCommand());

    const compoundCommand = new CompoundCommand(command1, command2, command3);

    afterEach(() => {
        sandbox.reset();
    });

    describe('execute', () => {
        it('Should execute the subcommands in order', () => {
            compoundCommand.execute();
            expect(command1.execute.calledOnce).to.be.true;
            expect(command2.execute.calledOnce).to.be.true;
            expect(command3.execute.calledOnce).to.be.true;
            expect(command1.execute.calledBefore(command2.execute)).to.be.true;
            expect(command2.execute.calledBefore(command3.execute)).to.be.true;
        });
        it('Should undo partially executed subcommands in  case of an error', () => {
            command3.execute.throwsException();

            expect(() => compoundCommand.execute()).to.throw();

            expect(command1.execute.calledOnce).to.be.true;
            expect(command2.execute.calledOnce).to.be.true;
            expect(command3.execute.calledOnce).to.be.true;
            expect(command1.undo.calledOnce).to.be.true;
            expect(command2.undo.calledOnce).to.be.true;
        });
    });

    describe('undo', () => {
        it('Should undo the subcommands in reverse order', () => {
            compoundCommand.undo();
            expect(command1.undo.calledOnce).to.be.true;
            expect(command2.undo.calledOnce).to.be.true;
            expect(command3.undo.calledOnce).to.be.true;
            expect(command1.undo.calledAfter(command2.undo)).to.be.true;
            expect(command2.undo.calledAfter(command3.undo)).to.be.true;
        });

        it('Should redo partially undone subcommands in  case of an error', () => {
            command1.undo.throwsException();

            expect(() => compoundCommand.undo()).to.throw();

            expect(command1.undo.calledOnce).to.be.true;
            expect(command2.undo.calledOnce).to.be.true;
            expect(command3.undo.calledOnce).to.be.true;
            expect(command3.redo.calledOnce).to.be.true;
            expect(command2.redo.calledOnce).to.be.true;
        });
    });

    describe('canUndo', () => {
        it('should return true if all subcommands can be undone', () => {
            command1.canUndo?.returns(true);
            command2.canUndo?.returns(true);
            command3.canUndo?.returns(true);
            expect(compoundCommand.canUndo()).to.be.true;
        });
        it('should return true if anyof the  subcommands cannot be undone', () => {
            command1.canUndo?.returns(true);
            command2.canUndo?.returns(false);
            command3.canUndo?.returns(true);
            expect(compoundCommand.canUndo()).to.be.true;
        });
    });
});
