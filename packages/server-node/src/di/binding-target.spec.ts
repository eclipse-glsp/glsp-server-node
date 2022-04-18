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
import { applyBindingTarget } from './binding-target';
// Simple no op classes to construct inversify binding syntaxes.
class Target {}

class SubTarget extends Target {}

describe('BindingTarget', () => {
    describe('bindTarget()', () => {
        // Setup nested spies for the fluent inversify binding API
        let context: {
            bind: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>;
            isBound: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], boolean>;
        };
        let toSyntax: sinon.SinonStubbedInstance<interfaces.BindingToSyntax<any>>;
        let whenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingWhenOnSyntax<any>>;

        const setupStubs = (): {
            context: {
                bind: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>;
                isBound: sinon.SinonStub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], boolean>;
            };
            toSyntax: sinon.SinonStubbedInstance<interfaces.BindingToSyntax<any>>;
            inWhenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingInWhenOnSyntax<any>>;
            whenOnSyntax: sinon.SinonStubbedInstance<interfaces.BindingWhenOnSyntax<any>>;
        } => {
            const container = new Container();
            const bind = sinon.stub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], interfaces.BindingToSyntax<any>>();
            const isBound = sinon.stub<[serviceIdentifier: interfaces.ServiceIdentifier<any>], boolean>();

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
                context: { bind, isBound },
                toSyntax,
                inWhenOnSyntax,
                whenOnSyntax
            };
        };

        beforeEach(() => {
            const stubs = setupStubs();
            context = stubs.context;
            toSyntax = stubs.toSyntax;
            whenOnSyntax = stubs.whenOnSyntax;
        });

        describe('Bind to constructor', () => {
            it('Should bind the service identifier `to` the given target with no scope', () => {
                applyBindingTarget(context, Target, SubTarget);
                expect(toSyntax.to.calledOnceWith(SubTarget)).to.be.true;
            });

            it('Should bind the service identifier `toSelf` with no scope', () => {
                applyBindingTarget(context, Target, Target);
                expect(toSyntax.toSelf.calledOnce).to.be.true;
            });
        });

        describe('Bind to service', () => {
            it('Should bind the service identifier `service` using the given target service with no scope', () => {
                context.isBound.returns(true);
                applyBindingTarget(context, Target, { service: SubTarget });
                expect(toSyntax.toService.calledOnceWith(SubTarget)).to.be.true;
            });
            it('Should throw an error because the given target service is not bound', () => {
                context.isBound.returns(false);
                expect(() => applyBindingTarget(context, Target, { service: SubTarget })).to.throw();
            });
            it('The return syntax should be no op and invocation of a syntax function should throw an error', () => {
                context.isBound.returns(true);
                const syntax = applyBindingTarget(context, Target, { service: SubTarget });
                expect(() => {
                    syntax.inSingletonScope();
                }).to.throw(
                    `${Target.toString()} has been bound to 'service'.` +
                        "Using 'in','when' or 'on' bindings after" +
                        "a 'toService' binding is not possible."
                );
            });
        });

        describe('Bind to constant value', () => {
            it('Should bind the service identifier `toConstantValue` using the given target with no scope', () => {
                const subTarget = new SubTarget();
                applyBindingTarget(context, Target, { constantValue: subTarget });
                expect(toSyntax.toConstantValue.calledOnceWith(subTarget)).to.be.true;
            });
            it("The return syntax's in functions should be no op and invocation should log a warning", () => {
                const spy = sinon.spy(console, 'warn');
                const subTarget = new SubTarget();
                const syntax = applyBindingTarget(context, Target, { constantValue: subTarget });
                syntax.inSingletonScope();
                expect(
                    spy.calledWith(
                        `${Target.toString()} has been bound to 'constantValue'. Binding in Singleton scope has no effect.` +
                            'Constant value bindings are effectively Singleton bindings.'
                    )
                ).to.be.true;
            });
        });

        describe('Bind to dynamic value', () => {
            it('Should bind the service identifier `toDynamicValue` using the given factory function with no scope', () => {
                applyBindingTarget(context, Target, { dynamicValue: context => new SubTarget() });
                expect(toSyntax.toDynamicValue.calledOnce);
            });
        });
    });
});
