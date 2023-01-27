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
import { expect } from 'chai';
import { Container, ContainerModule, injectable } from 'inversify';
import { InstanceMultiBinding, MultiBinding } from './multi-binding';

@injectable()
class TestClass {}

@injectable()
class TestClass1 extends TestClass {}

@injectable()
class TestClass2 extends TestClass {}

@injectable()
class TestClass3 extends TestClass {}

describe('test implementations of MultiBinding', () => {
    describe('test basic functionaly (ClassMultiBinding) ', () => {
        const binding = new MultiBinding('TestClass');
        it('add - new binding', () => {
            binding.add(TestClass1);
            expect(binding.contains(TestClass1)).true;

            const result = binding.getAll();
            expect(result.length).to.be.equal(1);
            expect(result[0]).to.be.equal(TestClass1);
        });

        it('add - existing binding', () => {
            binding.add(TestClass1);
            expect(binding.getAll().length).to.be.equal(1);
            expect(binding.getAll()[0]).to.be.equal(TestClass1);
        });

        it('remove - existing binding', () => {
            expect(binding.contains(TestClass1)).true;
            binding.remove(TestClass1);
            expect(binding.contains(TestClass1)).false;
            expect(binding.getAll()).to.have.length(0);
        });

        it('remove - non-existing binding', () => {
            const previousSize = binding.getAll().length;
            binding.remove(TestClass2);
            expect(binding.getAll()).to.have.length(previousSize);
        });

        it('addAll - TestClass1 & TestClass2', () => {
            binding.addAll([TestClass1, TestClass2]);

            const result = binding.getAll();
            expect(result.length).to.be.equal(2);
            expect(result.includes(TestClass1)).true;
            expect(result.includes(TestClass2)).true;
        });

        it('rebind- TestClass2 to TestClass3', () => {
            binding.rebind(TestClass2, TestClass3);
            const result = binding.getAll();
            expect(result.length).to.be.equal(2);
            expect(result.includes(TestClass1)).true;
            expect(result.includes(TestClass3)).true;
        });

        it('rebind- TestClass2 to TestClass3- should fail', () => {
            binding.rebind(TestClass2, TestClass3);
            const result = binding.getAll();
            expect(result.length).to.be.equal(2);
            expect(result.includes(TestClass1)).true;
            expect(result.includes(TestClass3)).true;
        });

        it('removeAll- TestClass1 & TestClass3', () => {
            binding.removeAll([TestClass1, TestClass3]);
            const result = binding.getAll();
            expect(result).to.have.length(0);
        });
    });

    describe('test applyBinding', () => {
        it('apply binding of ClassMultiBinding', () => {
            const testContainer = new Container();
            const testModule = new ContainerModule((bind, unbind, isBound, rebind) => {
                const context = { bind, unbind, isBound, rebind };
                const binding = new MultiBinding('TestClass');
                binding.addAll([TestClass1, TestClass2, TestClass3]);
                binding.applyBindings(context);
            });
            testContainer.load(testModule);
            const result = testContainer.getAll('TestClass');
            expect(result).to.have.length(3);
            expect(result.find(instance => instance instanceof TestClass1)).to.not.be.undefined;
            expect(result.find(instance => instance instanceof TestClass2)).to.not.be.undefined;
            expect(result.find(instance => instance instanceof TestClass3)).to.not.be.undefined;
        });

        it('apply binding of InstanceMultiBinding', () => {
            const t1 = 't1';
            const t2 = 't2';
            const t3 = 't3';
            const identifier = 'myStrings';

            const testContainer = new Container();
            const testModule = new ContainerModule((bind, unbind, isBound, rebind) => {
                const context = { bind, unbind, isBound, rebind };
                const binding = new InstanceMultiBinding<string>(identifier);
                binding.addAll([t1, t2, t3]);
                binding.applyBindings(context);
            });
            testContainer.load(testModule);
            const result = testContainer.get<string[]>(identifier);
            expect(result).to.have.length(3);
            expect(result.includes(t1)).true;
            expect(result.includes(t2)).true;
            expect(result.includes(t3)).true;
        });
    });
});
