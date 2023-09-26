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
import { inject, injectable, interfaces } from 'inversify';
import { Command } from '../command/command';
import { ModelState } from '../features/model/model-state';

/**
 * An operation handler can execute {@link Operation}s of a certain type (subclass).
 * The operation handler processes the operation in the {@link OperationHandler.execute()} method. The result
 * of the execution is a {@link Command} that captures the corresponding source model changes.
 * This command can be applied on the `CommandStack` and is reversible (undo) and can be reapplied (redo).
 *
 * The `OperationActionHandler` is responsible for retrieving all available (valid) operation handlers for an
 * operation that is dispatched via `ActionDispatcher`.
 */
@injectable()
export abstract class OperationHandler {
    @inject(ModelState)
    protected modelState: ModelState;

    /**
     * Returns the operation type that can be handled by this operation handler.
     *
     * @returns the operation type that can be handled.
     */
    abstract readonly operationType: string;

    readonly label?: string;

    /**
     * Creates a command that performs the operation in the source model(s). If `undefined` is  returned, no update
     * is performed on the model(s).
     *
     * @param operation The operation to process.
     * @return The created command to be executed on the command stack or `undefined` if nothing should be done.
     */
    abstract createCommand(operation: Operation): MaybePromise<Command | undefined>;

    /**
     * Executes the operation handler for the given {@link Operation} and returns the corresponding {@link Command}.
     * If the given operation cannot be handled by this handler or the handler execution did not result in any changes
     * `undefined` is returned.
     *
     * @param operation The operation that should be executed or empty if nothing should be done.
     * @returns The command capturing the execution changes or `undefined`
     */
    execute(operation: Operation): MaybePromise<Command | undefined> {
        return this.handles(operation) ? this.createCommand(operation) : undefined;
    }

    /**
     * Validates whether the given {@link Operation} can be handled by this operation handler.
     *
     * @param operation The operation that should be validated.
     * @returns `true` if the given operation can be handled, `false` otherwise.
     */
    handles(operation: Operation): boolean {
        return this.modelState.root && operation.kind === this.operationType;
    }
}

export const OperationHandlerConstructor = Symbol('OperationHandlerConstructor');

export type OperationHandlerConstructor = interfaces.Newable<OperationHandler>;

export const OperationHandlerFactory = Symbol('OperationHandlerFactory');

export type OperationHandlerFactory = (constructor: OperationHandlerConstructor) => OperationHandler;
