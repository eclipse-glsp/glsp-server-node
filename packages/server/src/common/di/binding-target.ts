/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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
import { AnyObject, Constructor } from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';
/**
 * Collection of utility types and functions to enable flexible service binding with dedicated
 * binding methods in the GLSP DI modules
 */

/**
 * Binds the given service identifier to the given {@link BindingTarget}. If the service identifier is
 * a {@link Constructor} and the target is the same constructor the service identifier will be bound to itself.
 * @param bind The inversify bind function (typically provided from a GLSP DI module)
 * @param serviceIdentifier The service identifier that should be bound.
 * @param target The binding target.
 * @returns The corresponding {@link interfaces.BindingInWhenOnSyntax}.
 */
export function applyBindingTarget<T>(
    context: { bind: interfaces.Bind; isBound: interfaces.IsBound },
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    target: BindingTarget<T>
): interfaces.BindingInWhenOnSyntax<T> {
    if (isConstructor(target)) {
        // If service identifier and target are the same constructor => self binding
        return serviceIdentifier === target //
            ? context.bind(serviceIdentifier).toSelf()
            : context.bind(serviceIdentifier).to(target);
    } else if (ServiceTarget.is(target)) {
        if (!context.isBound(target.service)) {
            const autoBind = target.autoBind === undefined || target.autoBind === true;
            if (autoBind && isConstructor(target.service)) {
                context.bind(target.service).toSelf().inSingletonScope();
            } else {
                throw new Error(`The target service ${target.service.toString()} is not bound!. Cannot apply target binding`);
            }
        }
        context.bind(serviceIdentifier).toService(target.service);
        return NoOPSyntax.serviceSyntax(serviceIdentifier, target);
    } else if (ConstantValueTarget.is(target)) {
        const whenOnSyntax = context.bind(serviceIdentifier).toConstantValue(target.constantValue);
        return NoOPSyntax.constantValueSyntax(serviceIdentifier, whenOnSyntax);
    } else {
        return context.bind(serviceIdentifier).toDynamicValue(_context => target.dynamicValue(_context));
    }
}

export function applyOptionalBindingTarget<T>(
    context: { bind: interfaces.Bind; isBound: interfaces.IsBound },
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    target?: BindingTarget<T>
): interfaces.BindingInWhenOnSyntax<T> | undefined {
    if (target) {
        return applyBindingTarget(context, serviceIdentifier, target);
    }
    return undefined;
}

/**
 * The different types of binding targets that can be returned by a dedicated binding method.
 */
export type BindingTarget<T> = Constructor<T> | DynamicValueTarget<T> | ConstantValueTarget<T> | ServiceTarget<T>;

/**
 * Binding target for service identifiers that should be bound `toConstantValue`.
 */
export interface ConstantValueTarget<T> {
    constantValue: T;
}

export namespace ConstantValueTarget {
    export function is(object: any): object is ConstantValueTarget<unknown> {
        return AnyObject.is(object) && 'constantValue' in object;
    }
}

/**
 * Binding target for service identifiers that should be bound `toService`.
 */
export interface ServiceTarget<T> {
    service: interfaces.ServiceIdentifier<T>;
    /**
     * Boolean flag to configure how to handle unbound service identifiers.
     * If `undefined` or `true` the {@link applyBindingTarget} function will attempt unbound constructor service identifiers
     * to `self().inSingletonScope()`.
     */
    autoBind?: boolean;
}

export namespace ServiceTarget {
    export function is(object: any): object is ServiceTarget<unknown> {
        return AnyObject.is(object) && 'service' in object;
    }
}

/**
 * Binding target for service identifiers that should be bound `toDynamicValue`.
 */
export interface DynamicValueTarget<T> {
    dynamicValue(context: interfaces.Context): T;
}

/**
 * No-op binding syntax definitions for `constantValue` and `toService` bindings.
 * Using this no-op syntaxes allows the {@link applyBindingTarget} function to return a {@link interfaces.BindingInWhenOnSyntax}
 * independently of the actual {@link BindingTarget}.
 */
namespace NoOPSyntax {
    export function constantValueSyntax(
        serviceIdentifier: interfaces.ServiceIdentifier<any>,
        syntax: interfaces.BindingWhenOnSyntax<any>
    ): interfaces.BindingInWhenOnSyntax<any> {
        const noOpReturn = (scope: string): interfaces.BindingWhenOnSyntax<any> => {
            console.warn(
                `${serviceIdentifier.toString()} has been bound to 'constantValue'. Binding in ${scope} scope has no effect.` +
                    'Constant value bindings are effectively Singleton bindings.'
            );
            return syntax;
        };
        return {
            ...syntax,
            inSingletonScope: () => noOpReturn('Singleton'),
            inRequestScope: () => noOpReturn('Request'),
            inTransientScope: () => noOpReturn('Transient')
        };
    }

    export function serviceSyntax(
        serviceIdentifier: interfaces.ServiceIdentifier<any>,
        target: BindingTarget<any>
    ): interfaces.BindingInWhenOnSyntax<any> {
        const noOpReturn = (): interfaces.BindingInWhenOnSyntax<any> => {
            const errorMsg =
                `${serviceIdentifier.toString()} has been bound to 'service'.` +
                "Using 'in','when' or 'on' bindings after" +
                "a 'toService' binding is not possible.";
            const error = new Error(errorMsg);
            error.name = 'NoOpInvocation';
            throw error;
        };
        const syntax = {
            onActivation: noOpReturn,
            onDeactivation: noOpReturn,
            when: noOpReturn,
            whenAnyAncestorIs: noOpReturn,
            whenAnyAncestorMatches: noOpReturn,
            whenAnyAncestorNamed: noOpReturn,
            whenAnyAncestorTagged: noOpReturn,
            whenInjectedInto: noOpReturn,
            whenNoAncestorIs: noOpReturn,
            whenNoAncestorMatches: noOpReturn,
            whenNoAncestorNamed: noOpReturn,
            whenNoAncestorTagged: noOpReturn,
            whenParentNamed: noOpReturn,
            whenParentTagged: noOpReturn,
            whenTargetIsDefault: noOpReturn,
            whenTargetNamed: noOpReturn,
            whenTargetTagged: noOpReturn,
            inRequestScope: noOpReturn,
            inSingletonScope: () => {
                if (ServiceTarget.is(target)) {
                    // toService bindings are essentially singleTons.
                    // We don't throw an error in this case.
                    return syntax;
                }
                return noOpReturn();
            },
            inTransientScope: noOpReturn
        };

        return syntax;
    }
}

export function isConstructor(object: any): object is Constructor<unknown> {
    return typeof object === 'function' && !!object.prototype && !!(object.prototype as any).constructor;
}
