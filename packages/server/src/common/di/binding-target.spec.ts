/********************************************************************************
 * Copyright (c) 2022-2026 EclipseSource and others.
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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { interfaces } from 'inversify';
import { applyBindingTarget } from './binding-target';
// Simple no op classes to construct inversify binding syntaxes.
class Target {}

class SubTarget extends Target {}

describe('BindingTarget', () => {
    describe('bindTarget()', () => {
        // Setup nested spies for the fluent inversify binding API
        let context: {
            bind: interfaces.Bind;
            isBound: interfaces.IsBound;
        };
        let toSyntax: interfaces.BindingToSyntax<any>;

        const setupStubs = (): {
            context: {
                bind: interfaces.Bind;
                isBound: interfaces.IsBound;
            };
            toSyntax: interfaces.BindingToSyntax<any>;
            inWhenOnSyntax: interfaces.BindingInWhenOnSyntax<any>;
            whenOnSyntax: interfaces.BindingWhenOnSyntax<any>;
        } => {
            const bind = vi.fn<interfaces.Bind>();
            const isBound = vi.fn<interfaces.IsBound>();

            const inWhenOnSyntax: interfaces.BindingInWhenOnSyntax<any> = {
                inRequestScope: vi.fn(),
                inSingletonScope: vi.fn(),
                inTransientScope: vi.fn(),
                when: vi.fn(),
                whenTargetNamed: vi.fn(),
                whenTargetIsDefault: vi.fn(),
                whenTargetTagged: vi.fn(),
                whenInjectedInto: vi.fn(),
                whenParentNamed: vi.fn(),
                whenParentTagged: vi.fn(),
                whenAnyAncestorIs: vi.fn(),
                whenNoAncestorIs: vi.fn(),
                whenAnyAncestorNamed: vi.fn(),
                whenAnyAncestorTagged: vi.fn(),
                whenNoAncestorNamed: vi.fn(),
                whenNoAncestorTagged: vi.fn(),
                whenAnyAncestorMatches: vi.fn(),
                whenNoAncestorMatches: vi.fn(),
                onActivation: vi.fn(),
                onDeactivation: vi.fn()
            } as unknown as interfaces.BindingInWhenOnSyntax<any>;

            const _whenOnSyntax: interfaces.BindingWhenOnSyntax<any> = {
                when: vi.fn(),
                whenTargetNamed: vi.fn(),
                whenTargetIsDefault: vi.fn(),
                whenTargetTagged: vi.fn(),
                whenInjectedInto: vi.fn(),
                whenParentNamed: vi.fn(),
                whenParentTagged: vi.fn(),
                whenAnyAncestorIs: vi.fn(),
                whenNoAncestorIs: vi.fn(),
                whenAnyAncestorNamed: vi.fn(),
                whenAnyAncestorTagged: vi.fn(),
                whenNoAncestorNamed: vi.fn(),
                whenNoAncestorTagged: vi.fn(),
                whenAnyAncestorMatches: vi.fn(),
                whenNoAncestorMatches: vi.fn(),
                onActivation: vi.fn(),
                onDeactivation: vi.fn()
            } as unknown as interfaces.BindingWhenOnSyntax<any>;

            const _toSyntax: interfaces.BindingToSyntax<any> = {
                to: vi.fn().mockReturnValue(inWhenOnSyntax),
                toSelf: vi.fn().mockReturnValue(inWhenOnSyntax),
                toConstantValue: vi.fn().mockReturnValue(_whenOnSyntax),
                toDynamicValue: vi.fn().mockReturnValue(inWhenOnSyntax),
                toService: vi.fn()
            } as unknown as interfaces.BindingToSyntax<any>;

            bind.mockReturnValue(_toSyntax);

            return {
                context: { bind, isBound } as unknown as { bind: interfaces.Bind; isBound: interfaces.IsBound },
                toSyntax: _toSyntax,
                inWhenOnSyntax,
                whenOnSyntax: _whenOnSyntax
            };
        };

        beforeEach(() => {
            const stubs = setupStubs();
            context = stubs.context;
            toSyntax = stubs.toSyntax;
        });

        describe('Bind to constructor', () => {
            it('Should bind the service identifier `to` the given target with no scope', () => {
                applyBindingTarget(context, Target, SubTarget);
                expect(vi.mocked(toSyntax.to)).toHaveBeenCalledExactlyOnceWith(SubTarget);
            });

            it('Should bind the service identifier `toSelf` with no scope', () => {
                applyBindingTarget(context, Target, Target);
                expect(vi.mocked(toSyntax.toSelf)).toHaveBeenCalledOnce();
            });
        });

        describe('Bind to service', () => {
            it('Should bind the service identifier `service` using the given target service with no scope', () => {
                vi.mocked(context.isBound).mockReturnValue(true);
                applyBindingTarget(context, Target, { service: SubTarget });
                expect(vi.mocked(toSyntax.toService)).toHaveBeenCalledExactlyOnceWith(SubTarget);
            });
            it('Should throw an error because the given target service is not bound', () => {
                vi.mocked(context.isBound).mockReturnValue(false);
                expect(() => applyBindingTarget(context, Target, { service: SubTarget, autoBind: false })).toThrow();
            });
            it('Should bind the unbound target service to itself before applying the toService binding', () => {
                vi.mocked(context.isBound).mockReturnValue(false);
                applyBindingTarget(context, Target, { service: SubTarget });
                expect(context.bind).toHaveBeenCalledWith(SubTarget);
            });
            it('The return syntax should be no op and invocation of a syntax function should throw an error', () => {
                vi.mocked(context.isBound).mockReturnValue(true);
                const syntax = applyBindingTarget(context, Target, { service: SubTarget });
                expect(() => {
                    syntax.inRequestScope();
                }).toThrow(
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
                expect(vi.mocked(toSyntax.toConstantValue)).toHaveBeenCalledExactlyOnceWith(subTarget);
            });
            it("The return syntax's in functions should be no op and invocation should log a warning", () => {
                const spy = vi.spyOn(console, 'warn');
                const subTarget = new SubTarget();
                const syntax = applyBindingTarget(context, Target, { constantValue: subTarget });
                syntax.inSingletonScope();
                expect(spy).toHaveBeenCalledWith(
                    `${Target.toString()} has been bound to 'constantValue'. Binding in Singleton scope has no effect.` +
                        'Constant value bindings are effectively Singleton bindings.'
                );
            });
        });

        describe('Bind to dynamic value', () => {
            it('Should bind the service identifier `toDynamicValue` using the given factory function with no scope', () => {
                applyBindingTarget(context, Target, { dynamicValue: _context => new SubTarget() });
                expect(vi.mocked(toSyntax.toDynamicValue)).toHaveBeenCalledOnce();
            });
        });
    });
});
