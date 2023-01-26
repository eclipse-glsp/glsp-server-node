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
import { Action, MaybePromise } from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';

export const ActionHandler = Symbol('ActionHandler');

/**
 * An action handler can execute certain {@link Action} types that are dispatched by the
 * {@link ActionDispatcher}. The action handler processes the action in the {@link ActionHandler.execute()}
 * method and returns a list of response actions to be dispatched as a result of processing the original action.
 * One action handler can handle multiple different action types, see {@link ActionHandler.actionKinds}.
 */
export interface ActionHandler {
    /**
     * Returns the list of action kinds that can be handled by this action handler.
     *
     * @returns A list of action kind strings.
     */
    actionKinds: string[];

    /**
     * Executes the action handler for the given {@link Action} and returns a list of response actions that should be
     * dispatched as a result of processing the original action. This list can be empty, if no more actions need to be
     * executed.
     *
     * @param action The action that should be processed.
     * @returns A list of response actions that should be dispatched.
     */
    execute(action: Action, ...args: unknown[]): MaybePromise<Action[]>;

    /**
     * Returns the priority of this action handler. The priority is used to derive the execution order if multiple
     * action handlers should execute the same {@link Action}. The default priority is `0` and the priority is sorted
     * descending. This means handlers with a priority &gt; 0 are executed before handlers with a default priority and
     * handlers with a priority &lt; 0 are executed afterwards.
     *
     * @returns the priority as integer.
     */
    priority?: number;
}

export const ActionHandlerConstructor = Symbol('ActionHandlerConstructor');

export type ActionHandlerConstructor = interfaces.Newable<ActionHandler>;

export const ActionHandlerFactory = Symbol('ActionHandlerFactory');

export type ActionHandlerFactory = (constructor: ActionHandlerConstructor) => ActionHandler;
