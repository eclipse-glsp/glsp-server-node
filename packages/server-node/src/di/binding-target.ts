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
import { AnyObject, Constructor, hasObjectProp } from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';
/**
 * Collection of utility types and functions to enable flexible service binding with dedicated
 * binding methods in the GLSP DI modules
 */

/**
 * Binds the given service identifier to the given {@link BindingTarget}. If a {@link BindingScopeType} is
 * present the service identifier will be bound in the corresponding scope. If the service identifier is
 * a {@link Constructor} and the target is the same constructor the service identifier will be bound to itself.
 * @param bind The inversify bind function (typically provided from a GLSP DI module)
 * @param serviceIdentifier The service identifier that should be bound.
 * @param target The binding target.
 * @param scope The options scope in which the service identifier should be bound.
 */
export function bindTarget<T>(
    bind: interfaces.Bind,
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    target: BindingTarget<T>,
    scope = BindingScope.NONE
): void {
    if (isConstructor(target)) {
        // If service identifier and target are the same constructor => self binding
        const to = serviceIdentifier === target ? bind(serviceIdentifier).toSelf() : bind(serviceIdentifier).to(target);
        BindingScope.apply(to, scope);
    } else if (ServiceTarget.is(target)) {
        bind(serviceIdentifier).toService(target.service);
    } else if (ConstantValueTarget.is(target)) {
        bind(serviceIdentifier).toConstantValue(target.constantValue);
    } else {
        const to = bind(serviceIdentifier).toDynamicValue(context => target.dynamicValue(context));
        BindingScope.apply(to, scope);
    }
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
        return AnyObject.is(object) && hasObjectProp(object, 'constantValue');
    }
}

/**
 * Binding target for service identifiers that should be bound `toService`.
 */
export interface ServiceTarget<T> {
    service: interfaces.ServiceIdentifier<T>;
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
 *
 */
export enum BindingScope {
    NONE = 0,
    SINGLETON = 1,
    TRANSIENT = 2,
    REQUEST = 3
}

export namespace BindingScope {
    /**
     * Applies the given {@link BindingScope} to the given {@link interfaces.BindingInWhenOnSyntax}
     * i.e. executes the syntax function that corresponds to the given scope.
     * @param syntax The syntax object the scope should be applied to.
     * @param scope The scope that should be applied.
     * @returns The {@link BindingWhenOnSyntax} after scope application.
     */
    export function apply<T>(syntax: interfaces.BindingInWhenOnSyntax<T>, scope: BindingScope): interfaces.BindingWhenOnSyntax<T> {
        switch (scope) {
            case BindingScope.NONE:
                return syntax;
            case BindingScope.SINGLETON:
                return syntax.inSingletonScope();
            case BindingScope.TRANSIENT:
                return syntax.inTransientScope();
            case BindingScope.REQUEST:
                return syntax.inRequestScope();
        }
    }
}

export type BindingScopeType = keyof typeof BindingScope;

// TODO: Move into `@eclipse-glsp/protocol` alongside the `Constructor` definition
export function isConstructor(object: any): object is Constructor<unknown> {
    return typeof object === 'function' && !!object.prototype && !!(object.prototype as any).constructor;
}
