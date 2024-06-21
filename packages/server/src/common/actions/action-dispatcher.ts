/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
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
import {
    Action,
    Disposable,
    MaybeArray,
    RequestAction,
    ResponseAction,
    SetModelAction,
    UpdateModelAction,
    flatPush
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ClientId } from '../di/service-identifiers';
import { GLSPServerError } from '../utils/glsp-server-error';
import { Logger } from '../utils/logger';
import { PromiseQueue } from '../utils/promise-queue';
import { ActionHandler } from './action-handler';
import { ActionHandlerRegistry } from './action-handler-registry';
import { ClientActionForwarder } from './client-action-handler';

export const ActionDispatcher = Symbol('ActionDispatcher');

/**
 * The central component that process all {@link Action}s by dispatching them to their designated
 * handlers.
 */
export interface ActionDispatcher {
    /**
     * Processes the given action by dispatching it to all registered handlers.
     *
     * @param action The action that should be dispatched.
     * @returns A promise indicating when the action processing is complete.
     */
    dispatch(action: Action): Promise<void>;

    /**
     * Processes all given actions by dispatching to the corresponding handlers.
     *
     * @param actions Actions to dispatch
     * @returns A promise indicating that all actions have been processed.
     */
    dispatchAll(actions: Action[]): Promise<void>;
    dispatchAll(...actions: Action[]): Promise<void>;

    /**
     * Processes all given actions, by dispatching them to the corresponding handlers, after the next model update.
     * The given actions are queued until the next model update cycle has been completed i.e. an
     * `UpdateModelAction` has been dispatched and processed by this action dispatcher.
     *
     * @param actions The actions that should be dispatched after the next model update
     */
    dispatchAfterNextUpdate(actions: Action[]): void;
    dispatchAfterNextUpdate(...actions: Action[]): void;
}

@injectable()
export class DefaultActionDispatcher implements ActionDispatcher, Disposable {
    @inject(ActionHandlerRegistry)
    protected actionHandlerRegistry: ActionHandlerRegistry;

    @inject(ClientActionForwarder)
    protected clientActionForwarder: ClientActionForwarder;

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientId)
    protected clientId: string;

    protected actionQueue = new PromiseQueue();
    protected postUpdateQueue: Action[] = [];

    dispatch(action: Action): Promise<void> {
        // Dont queue actions that are just delegated to the client
        if (this.clientActionForwarder.shouldForwardToClient(action)) {
            return this.doDispatch(action);
        }
        return this.actionQueue.enqueue(() => this.doDispatch(action));
    }

    protected async doDispatch(action: Action): Promise<void> {
        this.logger.debug('Dispatch action:', action.kind);
        const handledOnClient = this.clientActionForwarder.handle(action);

        const actionHandlers = this.actionHandlerRegistry.get(action.kind);
        if (!handledOnClient && actionHandlers.length === 0) {
            throw new GLSPServerError(`No handler registered for action kind: ${action.kind}`);
        }

        const responses: Action[] = [];
        for (const handler of actionHandlers) {
            const response = await this.executeHandler(handler, action);
            responses.push(...response);
        }

        if (this.postUpdateQueue.length > 0 && (UpdateModelAction.is(action) || SetModelAction.is(action))) {
            responses.push(...this.postUpdateQueue);
            this.postUpdateQueue = [];
        }

        await this.dispatchResponses(responses);
    }

    protected async executeHandler(handler: ActionHandler, request: Action): Promise<Action[]> {
        const responseActions = await handler.execute(request);
        return responseActions.map(action => respond(request, action));
    }

    protected dispatchResponses(actions: Action[]): Promise<void> {
        if (actions.length === 0) {
            return Promise.resolve();
        }
        const responseQueue = new PromiseQueue();
        const responses = actions.map(action => responseQueue.enqueue(() => this.doDispatch(action)));
        return Promise.all(responses).then(() => Promise.resolve());
    }

    dispatchAll(...actions: MaybeArray<Action>[]): Promise<void> {
        if (actions.length === 0) {
            return Promise.resolve();
        }
        const flat: Action[] = [];
        flatPush(flat, actions);
        return Promise.all(flat.map(action => this.dispatch(action))).then(() => Promise.resolve());
    }

    dispatchAfterNextUpdate(...actions: MaybeArray<Action>[]): void {
        if (actions.length !== 0) {
            flatPush(this.postUpdateQueue, actions);
        }
    }

    dispose(): void {
        this.actionQueue.clear();
    }
}

/**
 * Transfers the {@link RequestAction.requestId id} from request to response if applicable.
 *
 * @param request  potential {@link RequestAction}
 * @param response potential {@link ResponseAction}
 * @returns given response action with id set if applicable
 */
export function respond(request: Action, response: Action): Action {
    if (RequestAction.is(request) && ResponseAction.is(response)) {
        (response as any).responseId = request.requestId;
    }
    return response;
}
