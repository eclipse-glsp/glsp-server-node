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
import { MaybePromise, Operation } from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';

export const OperationHandler = Symbol('OperationHandler');

/**
 * An operation handler can execute {@link Operation}s of a certain type (subclass).
 * The operation handler processes the operation in the {@link OperationHandler.execute()} method. The result
 * of the execution is an update of the `ModelState` state.
 * This update is reversible (undo) and can be reapplied (redo). For basic diagram languages these updates are typically
 * applied directly on the `ModelState` using EMF `Command`s and the
 * `ModelState.execute()` method. For more complex diagram languages the
 * GModel state might be updated indirectly and the operation handler manipulates a custom model representation.
 *
 * The `OperationActionHandler` is responsible for retrieving all available (valid) operation handlers for an
 * operation that is dispatched via `ActionDispatcher`.
 */
export interface OperationHandler {
    /**
     * Returns the operation type that can be handled by this operation handler.
     *
     * @returns the operation type that can be handled.
     */
    readonly operationType: string;

    readonly label?: string;

    /**
     * Executes the operation handler for the given {@link Operation}.
     *
     * @param operation The operation that should be executed.
     */
    execute(operation: Operation): MaybePromise<void>;
}

export const OperationHandlerConstructor = Symbol('OperationHandlerConstructor');

export type OperationHandlerConstructor = interfaces.Newable<OperationHandler>;

export const OperationHandlerFactory = Symbol('OperationHandlerFactory');

export type OperationHandlerFactory = (constructor: OperationHandlerConstructor) => OperationHandler;
