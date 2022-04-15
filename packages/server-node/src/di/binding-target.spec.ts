/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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
import { Container, ContainerModule, interfaces } from 'inversify';
import * as sinon from 'sinon';
import { BindingScope, bindTarget } from './binding-target';
// Simple no op classes to construct inversify binding syntaxes.
class Target {}

class SubTarget extends Target {}

describe('BindingTarget', () => {
    describe('bindTarget()', () => {
        // Setup nested spies for the fluent inversify binding API
        let bind: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>;
        let toSyntax: sinon.SinonStubbedInstance<interfaces.BindingToSyntax<any>>;
        let inWhenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingInWhenOnSyntax<any>>;
        let whenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingWhenOnSyntax<any>>;

        const setupStubs = (): {
            bind: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>;
            toSyntax: sinon.SinonStubbedInstance<interfaces.BindingToSyntax<any>>;
            inWhenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingInWhenOnSyntax<any>>;
            whenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingWhenOnSyntax<any>>;
        } => {
            const container = new Container();
            const bind = sinon.stub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>();
            let toSyntax: sinon.SinonStubbedInstance<interfaces.BindingToSyntax<any>> = {} as any;
            let inWhenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingInWhenOnSyntax<any>> = {} as any;
            container.load(
                new ContainerModule(_bind => {
                    const toStub = _bind('StubMe');
                    inWhenOnSyntax = sinon.stub(toStub.to(Target));
                    whenOnSyntax = sinon.stub(toStub.toConstantValue(''));
                    toSyntax = sinon.stub(toStub);

                    bind.returns(toSyntax);
                    toSyntax.to.returns(inWhenOnSyntax);
                    toSyntax.toSelf.returns(inWhenOnSyntax);
                    toSyntax.toDynamicValue.returns(inWhenOnSyntax);
                    toSyntax.toService.returns();
                })
            );
            return {
                bind,
                toSyntax,
                inWhenOnSyntax,
                whenOnSyntax
            };
        };

        beforeEach(() => {
            const stubs = setupStubs();
            bind = stubs.bind;
            toSyntax = stubs.toSyntax;
            inWhenOnSyntax = stubs.inWhenOnSyntax;
            whenOnSyntax = stubs.whenOnSyntax;
        });

        describe('Bind to constructor', () => {
            it('Should bind the service identifier `to` the given target with no scope', () => {
                bindTarget(bind, Target, SubTarget);
                expect(toSyntax.to.calledOnceWith(SubTarget)).to.be.true;
                expectNoScopeBinding();
            });

            it('Should bind the service identifier `to` the given target in singleton scope', () => {
                bindTarget(bind, Target, SubTarget, BindingScope.SINGLETON);
                expect(toSyntax.to.calledOnceWith(SubTarget)).to.be.true;
                expect(inWhenOnSyntax.inSingletonScope.calledOnce).to.be.true;
                expect(inWhenOnSyntax.inRequestScope.callCount).to.be.equal(0);
                expect(inWhenOnSyntax.inTransientScope.callCount).to.be.equal(0);
            });

            it('Should bind the service identifier `toSelf` with no scope', () => {
                bindTarget(bind, Target, Target);
                expect(toSyntax.toSelf.calledOnce).to.be.true;
                expectNoScopeBinding();
            });

            it('Should bind the service identifier `toSelf` in RequestScope', () => {
                bindTarget(bind, Target, Target, BindingScope.REQUEST);
                expect(toSyntax.toSelf.calledOnce).to.be.true;
                expect(inWhenOnSyntax.inRequestScope.calledOnce).to.be.true;
                expect(inWhenOnSyntax.inSingletonScope.callCount).to.be.equal(0);
                expect(inWhenOnSyntax.inTransientScope.callCount).to.be.equal(0);
            });
        });

        describe('Bind to service', () => {
            it('Should bind the service identifier `service` using the given target service with no scope', () => {
                bindTarget(bind, Target, { service: SubTarget });
                expect(toSyntax.toService.calledOnceWith(SubTarget)).to.be.true;
                expectNoScopeBinding();
            });
        });

        describe('Bind to constant value', () => {
            it('Should bind the service identifier `toService` using the given target with no scope', () => {
                const subTarget = new SubTarget();
                bindTarget(bind, Target, { constantValue: subTarget });
                expect(toSyntax.toConstantValue.calledOnceWith(subTarget)).to.be.true;
                expectNoScopeBinding();
            });
        });

        describe('Bind to dynamic value', () => {
            it('Should bind the service identifier `toDynamicValue` using the given factory function with no scope', () => {
                bindTarget(bind, Target, { dynamicValue: context => new SubTarget() });
                expect(toSyntax.toDynamicValue.calledOnce).to.be.true;
                expectNoScopeBinding();
            });

            it('Should bind the service identifier `toDynamicValue` using the given factory function in transient scope', () => {
                bindTarget(bind, Target, { dynamicValue: context => new SubTarget() }, BindingScope.TRANSIENT);
                expect(toSyntax.toDynamicValue.calledOnce).to.be.true;
                expect(inWhenOnSyntax.inTransientScope.calledOnce).to.be.true;
                expect(inWhenOnSyntax.inSingletonScope.callCount).to.be.equal(0);
                expect(inWhenOnSyntax.inRequestScope.callCount).to.be.equal(0);
            });
        });

        function expectNoScopeBinding(): void {
            expect(inWhenOnSyntax.inRequestScope.callCount).to.be.equal(0);
            expect(inWhenOnSyntax.inTransientScope.callCount).to.be.equal(0);
            expect(inWhenOnSyntax.inSingletonScope.callCount).to.be.equal(0);
        }
    });

    describe('BindingScope', () => {
        describe('apply()', () => {
            let syntax: interfaces.BindingInWhenOnSyntax<unknown>;
            const container = new Container();
            container.load(
                new ContainerModule(bind => {
                    syntax = bind('Test').to(Target);
                })
            );
            const sandbox = sinon.createSandbox();
            let syntaxSpy: sinon.SinonSpiedInstance<interfaces.BindingInWhenOnSyntax<unknown>>;
            beforeEach(() => {
                syntaxSpy = sandbox.spy(syntax);
            });

            afterEach(() => {
                sandbox.restore();
            });
            describe('BindingsScope.NONE', () => {
                it('Should return the initially given syntax', () => {
                    const result = BindingScope.apply(syntax, BindingScope.NONE);
                    expect(result).to.be.equal(syntax);
                });
            });

            describe('BindingsScope.SINGLETON', () => {
                it('Should execute `inSingletonScope` on the given syntax', () => {
                    BindingScope.apply(syntax, BindingScope.SINGLETON);
                    expect(syntaxSpy.inSingletonScope.calledOnce).to.be.true;
                });
            });

            describe('BindingsScope.REQUEST', () => {
                it('Should execute `inRequestScope` on the given syntax', () => {
                    BindingScope.apply(syntax, BindingScope.REQUEST);
                    expect(syntaxSpy.inRequestScope.calledOnce).to.be.true;
                });
            });

            describe('BindingsScope.TRANSIENT', () => {
                it('Should execute `inTransientScope` on the given syntax', () => {
                    BindingScope.apply(syntax, BindingScope.TRANSIENT);
                    expect(syntaxSpy.inTransientScope.calledOnce).to.be.true;
                });
            });
        });
    });
});
