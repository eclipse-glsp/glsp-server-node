/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
    Deferred,
    Disposable,
    MaybeArray,
    RejectAction,
    RequestAction,
    ResponseAction,
    SetModelAction,
    UpdateModelAction,
    flatPush
} from '@eclipse-glsp/protocol';
import { inject, injectable, postConstruct } from 'inversify';
import { ClientId } from '../di/service-identifiers';
import { ActionQueue } from '../utils/action-queue';
import { GLSPServerError } from '../utils/glsp-server-error';
import { Logger } from '../utils/logger';
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
     * Responses matching a pending {@link request} short-circuit and resolve that
     * request without being passed to handlers.
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

    /**
     * Dispatches a request action and returns a promise that resolves when a matching response
     * action is dispatched or rejects if the response is a {@link RejectAction}. The response is
     * _not_ passed to the registered action handlers. Instead, it is the responsibility of the
     * caller of this method to handle the response properly.
     *
     * If the request's `kind` is registered in `ClientActionKinds`, it is forwarded to the client
     * via {@link ClientActionForwarder}. If server-side handlers are registered, they are also
     * executed.
     *
     * Only the first matching response resolves the request. Any additional or late responses
     * are dispatched as normal actions.
     *
     * The promise waits indefinitely until a response arrives or the dispatcher is disposed.
     * Use {@link requestUntil} if a timeout is needed.
     *
     * Note: mutates `action.requestId` (if unset) and `action.timeout`.
     *
     * @param action The request action to dispatch.
     * @returns A promise that resolves with the matching response action.
     */
    request<Res extends ResponseAction>(action: RequestAction<Res>): Promise<Res>;

    /**
     * Dispatches a request and waits for a response until the timeout given in `timeoutMs` has
     * been reached. The returned promise is resolved when a response with a matching identifier
     * is dispatched or when the timeout has been reached. That response is _not_ passed to the
     * registered action handlers. Instead, it is the responsibility of the caller of this method
     * to handle the response properly.
     * If `rejectOnTimeout` is set to `false` (default) the returned promise will be resolved with
     * no value, otherwise it will be rejected.
     *
     * Note: mutates `action.requestId` (if unset) and `action.timeout`.
     *
     * @param action The request action to dispatch.
     * @param timeoutMs Maximum wait time in milliseconds. Defaults to
     *        {@link RequestAction.timeout} if set, otherwise 2000 ms.
     * @param rejectOnTimeout Whether to reject the promise on timeout.
     * @returns The matching response, or `undefined` on soft timeout.
     */
    requestUntil<Res extends ResponseAction>(
        action: RequestAction<Res>,
        timeoutMs?: number,
        rejectOnTimeout?: boolean
    ): Promise<Res | undefined>;
}

export const ActionDispatchScope = Symbol('ActionDispatchScope');

/**
 * Scope marker that lets the {@link ActionDispatcher} know whether a call to `dispatch()`
 * originates from inside a running handler (reentrant) or from outside (external).
 *
 * The {@link DefaultActionDispatcher.processActionQueue} loop wraps each action in {@link enter}
 * so that reentrant `dispatch()` calls (handler responses, injected dispatcher calls) can be
 * recognized via {@link isReentrant} and executed inline instead of being queued.
 *
 * Used by the {@link DefaultActionDispatcher} implementation.
 */
export interface ActionDispatchScope {
    /**
     * Executes the callback inside the dispatch scope. While the callback (and its full async
     * continuation) is running, {@link isReentrant} returns `true` for reentrant calls.
     */
    enter<R>(callback: () => R): R;

    /**
     * Returns `true` if the given dispatch is reentrant — i.e. it originates from within a
     * running {@link enter} callback (handler response or injected dispatcher call) and should
     * run inline rather than being queued.
     *
     * Implementations may inspect the action to apply additional guards, e.g. to ensure
     * client-originated actions are always queued regardless of scope state.
     */
    isReentrant(action: Action): boolean;
}

/**
 * Default {@link ActionDispatcher}. External dispatches are queued and processed one at a
 * time; dispatches made from within a running handler run inline with the containing action.
 */
@injectable()
export class DefaultActionDispatcher implements ActionDispatcher, Disposable {
    protected static readonly STALE_TIMEOUT_GRACE_MS = 30_000;

    @inject(ActionHandlerRegistry)
    protected actionHandlerRegistry: ActionHandlerRegistry;

    @inject(ClientActionForwarder)
    protected clientActionForwarder: ClientActionForwarder;

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientId)
    protected clientId: string;

    @inject(ActionDispatchScope)
    protected dispatchScope: ActionDispatchScope;

    protected actionQueue = new ActionQueue<Action>();

    protected postUpdateQueue: Action[] = [];
    protected readonly pendingRequests = new Map<string, Deferred<ResponseAction | undefined>>();
    protected readonly requestTimeouts = new Map<string, NodeJS.Timeout>();
    protected nextRequestId = 1;

    @postConstruct()
    protected initialize(): void {
        // Fire-and-forget: the loop is meant to run for the dispatcher's lifetime; surface any
        // unexpected termination via the logger instead of an unhandled rejection.
        this.processActionQueue().catch(error => this.logger.error('Action queue processor terminated unexpectedly', error));
    }

    protected generateRequestId(): string {
        return `server_${this.clientId}_${this.nextRequestId++}`;
    }

    dispatch(action: Action): Promise<void> {
        // Intercept first to avoid deadlock: a handler may be awaiting this response.
        if (this.interceptPendingResponse(action)) {
            return Promise.resolve();
        }
        // Reentrant dispatches run inline to preserve ordering with the containing action.
        if (this.dispatchScope.isReentrant(action)) {
            return this.doDispatch(action);
        }
        // External dispatches are queued and processed sequentially.
        return this.actionQueue.push(action);
    }

    protected async processActionQueue(): Promise<void> {
        // Process each action inside the dispatch scope so reentrant dispatch() calls are recognized.
        for await (const entry of this.actionQueue.consume()) {
            try {
                await this.dispatchScope.enter(() => this.doDispatch(entry.item));
                entry.resolve();
            } catch (error) {
                entry.reject(error);
            }
        }
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

        // Append post-update actions to responses so they are dispatched in the same inline
        // batch as the handler responses, preserving sequential order.
        responses.push(...this.drainPostUpdateQueue(action));

        await this.dispatchResponses(responses);
    }

    protected async executeHandler(handler: ActionHandler, action: Action): Promise<Action[]> {
        const responseActions = await handler.execute(action);
        return responseActions.map(response => respond(action, response));
    }

    protected async dispatchResponses(actions: Action[]): Promise<void> {
        // Sequential dispatch inside the current dispatch scope. Each response goes inline via
        // the reentrant path, or is intercepted if it resolves a pending request().
        for (const action of actions) {
            await this.dispatch(action);
        }
    }

    async dispatchAll(...actions: MaybeArray<Action>[]): Promise<void> {
        if (actions.length === 0) {
            return;
        }
        const flat: Action[] = [];
        flatPush(flat, actions);
        // Sequential dispatch: external calls were already FIFO via the queue, but reentrant
        // calls also need deterministic ordering so handlers see each other's effects in order.
        for (const action of flat) {
            await this.dispatch(action);
        }
    }

    dispatchAfterNextUpdate(...actions: MaybeArray<Action>[]): void {
        if (actions.length !== 0) {
            flatPush(this.postUpdateQueue, actions);
        }
    }

    request<Res extends ResponseAction>(action: RequestAction<Res>): Promise<Res> {
        return this.doRequest(action, undefined, true) as Promise<Res>;
    }

    requestUntil<Res extends ResponseAction>(
        action: RequestAction<Res>,
        timeoutMs: number = action.timeout ?? 2000,
        rejectOnTimeout = false
    ): Promise<Res | undefined> {
        return this.doRequest(action, timeoutMs, rejectOnTimeout);
    }

    protected doRequest<Res extends ResponseAction>(
        action: RequestAction<Res>,
        timeoutMs: number | undefined,
        rejectOnTimeout: boolean
    ): Promise<Res | undefined> {
        if (!action.requestId || action.requestId === '') {
            action.requestId = this.generateRequestId();
        }
        // Stamp the effective timeout onto the action so the receiving side
        // (handleServerRequest/handleClientRequest) can respect it.
        action.timeout = timeoutMs;

        const deferred = new Deferred<ResponseAction | undefined>();
        this.pendingRequests.set(action.requestId, deferred);

        if (timeoutMs !== undefined) {
            const timeout = setTimeout(() => {
                if (this.pendingRequests.delete(action.requestId)) {
                    // Keep the requestTimeouts entry briefly as a stale marker so a late response
                    // can be filtered, then drop it after a grace period to avoid leaking markers
                    // for requests whose late responses never arrive.
                    const cleanup = setTimeout(
                        () => this.requestTimeouts.delete(action.requestId),
                        DefaultActionDispatcher.STALE_TIMEOUT_GRACE_MS
                    );
                    cleanup.unref?.();
                    const message = `Request '${action.requestId}' (${action.kind}) timed out after ${timeoutMs}ms`;
                    if (rejectOnTimeout) {
                        deferred.reject(new Error(message));
                    } else {
                        this.logger.info(message);
                        deferred.resolve(undefined);
                    }
                }
            }, timeoutMs);

            this.requestTimeouts.set(action.requestId, timeout);
        }

        // dispatch() routes correctly on its own: external callers queue, handler-internal
        // callers run inline via the ActionDispatchScope. The matching response resolves
        // the deferred out-of-band via interceptPendingResponse().
        const dispatchPromise = this.dispatch(action);

        dispatchPromise.catch(error => {
            if (this.pendingRequests.delete(action.requestId)) {
                const timeout = this.requestTimeouts.get(action.requestId);
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                    this.requestTimeouts.delete(action.requestId);
                }
                deferred.reject(error);
            }
        });

        return deferred.promise as Promise<Res | undefined>;
    }

    /**
     * If the given action is a {@link SetModelAction} or {@link UpdateModelAction} and there are actions
     * queued via {@link dispatchAfterNextUpdate}, drain and return them.
     *
     * @returns The drained actions, or an empty array if nothing to drain.
     */
    protected drainPostUpdateQueue(action: Action): Action[] {
        if (this.postUpdateQueue.length > 0 && (UpdateModelAction.is(action) || SetModelAction.is(action))) {
            const actions = [...this.postUpdateQueue];
            this.postUpdateQueue = [];
            return actions;
        }
        return [];
    }

    /**
     * Checks whether the given action is a response matching a pending {@link request} or
     * {@link requestUntil} call. If matched, resolves (or rejects) the corresponding deferred
     * and returns `true` so the caller can short-circuit normal dispatch.
     *
     * For responses with a valid `responseId` but no matching pending request, checks for a stale
     * timeout entry (timed-out request) and clears the `responseId` so the action is not forwarded
     * by {@link ClientActionForwarder}. If no stale entry exists, the `responseId` is left intact
     * for normal forwarding.
     */
    protected interceptPendingResponse(action: Action): boolean {
        if (!ResponseAction.hasValidResponseId(action)) {
            return false;
        }
        const deferred = this.pendingRequests.get(action.responseId);
        if (deferred !== undefined) {
            this.pendingRequests.delete(action.responseId);
            const timeout = this.requestTimeouts.get(action.responseId);
            if (timeout !== undefined) {
                clearTimeout(timeout);
                this.requestTimeouts.delete(action.responseId);
            }
            // Intercepted responses skip doDispatch, so drain post-update actions here when the
            // response is an UpdateModel/SetModel. RejectAction does not trigger a drain; pending
            // post-update actions stay queued until the next successful update.
            const postUpdateActions = this.drainPostUpdateQueue(action);
            if (RejectAction.is(action)) {
                deferred.reject(new Error(`${action.message}${action.detail ? ': ' + action.detail : ''}`));
            } else {
                deferred.resolve(action);
            }
            if (postUpdateActions.length > 0) {
                // Fire-and-forget: callers of request() expect the resolved response, not the
                // unrelated post-update fan-out; awaiting here would couple them unnecessarily.
                this.dispatchResponses(postUpdateActions).catch(error =>
                    this.logger.error('Failed to dispatch post-update actions', error)
                );
            }
            return true;
        }
        // Late response for a timed-out request: clear responseId so ClientActionForwarder does
        // not re-emit it to the client.
        const staleTimeout = this.requestTimeouts.get(action.responseId);
        if (staleTimeout !== undefined) {
            clearTimeout(staleTimeout);
            this.requestTimeouts.delete(action.responseId);
            this.logger.debug(`Late response for timed-out request '${action.responseId}', dispatching as normal action`);
            action.responseId = '';
        }
        return false;
    }

    dispose(): void {
        // Reject queued actions: no further processing should happen after dispose.
        this.actionQueue.rejectPending(new Error('ActionDispatcher disposed'));
        this.actionQueue.stop();
        this.pendingRequests.forEach((deferred, id) => deferred.reject(new Error(`Request '${id}' cancelled: dispatcher disposed`)));
        this.pendingRequests.clear();
        this.requestTimeouts.forEach(timeout => clearTimeout(timeout));
        this.requestTimeouts.clear();
        this.postUpdateQueue = [];
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
        response.responseId = request.requestId;
    }
    return response;
}
