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
import { Action, Deferred, RejectAction, RequestAction, ResponseAction, UpdateModelAction } from '@eclipse-glsp/protocol';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Container, ContainerModule } from 'inversify';
import { ActionDispatchScope, DefaultActionDispatcher } from '../../common/actions/action-dispatcher';
import { ActionHandler } from '../../common/actions/action-handler';
import { ActionHandlerRegistry } from '../../common/actions/action-handler-registry';
import { ClientActionForwarder } from '../../common/actions/client-action-handler';
import { ClientActionKinds, ClientId } from '../../common/di/service-identifiers';
import { ClientSessionManager } from '../../common/session/client-session-manager';
import * as mock from '../../common/test/mock-util';
import { Logger } from '../../common/utils/logger';
import { NodeActionDispatchScope } from '../di/node-action-dispatch-scope';

function waitSync(timeInMillis: number): void {
    const start = Date.now();
    let now = start;
    while (now - start < timeInMillis) {
        now = Date.now();
    }
}

describe('test DefaultActionDispatcher', () => {
    const container = new Container();
    const clientId = 'myClientId';
    const actionHandlerRegistry = new ActionHandlerRegistry();
    let registry_get_stub: MockInstance<(kind: string) => ActionHandler[]>;

    const clientActionForwarderStub = {
        shouldForwardToClient: vi.fn(),
        handle: vi.fn()
    } as unknown as ClientActionForwarder;

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(ClientSessionManager).toConstantValue(new mock.StubClientSessionManager());
            bind(ClientId).toConstantValue(clientId);
            bind(ActionHandlerRegistry).toConstantValue(actionHandlerRegistry);
            bind(ClientActionKinds).toConstantValue(new Set(['response', 'response1', 'response2']));
            bind(ClientActionForwarder).toConstantValue(clientActionForwarderStub);
            bind(ActionDispatchScope).to(NodeActionDispatchScope);
        })
    );
    const actionDispatcher = container.resolve(DefaultActionDispatcher);

    beforeEach(() => {
        registry_get_stub = vi.spyOn(actionHandlerRegistry, 'get');
    });

    describe('test with one-way actions (no response actions)', () => {
        it('dispatch- unhandled action', async () => {
            await expect(actionDispatcher.dispatch({ kind: 'unhandled' })).rejects.toThrow();
        });

        it('dispatch - one action', async () => {
            // Mock setup
            const action = 'action';
            const handler = new mock.StubActionHandler([action]);
            const getHandler = (kind: string): ActionHandler[] => (kind === action ? [handler] : []);
            registry_get_stub.mockImplementation(getHandler);
            const spy_handler_execute = vi.spyOn(handler, 'execute');
            // Test execution
            await actionDispatcher.dispatch({ kind: action });
            expect(spy_handler_execute).toHaveBeenCalledOnce();
        });

        describe('test multi dispatch with single-handled actions', () => {
            // Mock Setup
            const action1 = 'a1';
            const action2 = 'a2';
            const action3 = 'a3';

            const handler1 = new mock.StubActionHandler([action1]);
            const handler2 = new mock.StubActionHandler([action2]);
            const handler3 = new mock.StubActionHandler([action3]);

            let spy_handler1_execute: MockInstance;
            let spy_handler2_execute: MockInstance;
            let spy_handler3_execute: MockInstance;
            // restoreMocks: true (from the shared Vitest preset) restores these spies between tests,
            // dropping the mockReturnValue setup, so they have to be re-created here before each test.
            beforeEach(() => {
                spy_handler1_execute = vi.spyOn(handler1, 'execute').mockReturnValue([]);
                spy_handler2_execute = vi.spyOn(handler2, 'execute').mockReturnValue([]);
                spy_handler3_execute = vi.spyOn(handler3, 'execute').mockReturnValue([]);
            });
            const handlerMockImpl = (kind: string): ActionHandler[] => {
                switch (kind) {
                    case action1:
                        return [handler1];
                    case action2:
                        return [handler2];
                    case action3:
                        return [handler3];
                    default:
                        return [];
                }
            };

            it('dispatch - multiple actions', async () => {
                // Mock setup
                registry_get_stub.mockImplementation(handlerMockImpl);
                // Test execution
                actionDispatcher.dispatch({ kind: action1 });
                actionDispatcher.dispatch({ kind: action2 });
                await actionDispatcher.dispatch({ kind: action3 });
                // Check if all handlers have been called
                expect(spy_handler1_execute).toHaveBeenCalled();
                expect(spy_handler2_execute).toHaveBeenCalled();
                expect(spy_handler3_execute).toHaveBeenCalled();
                // Check if all handlers have been called in the right order
                expect(spy_handler1_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler2_execute.mock.invocationCallOrder[0]);
                expect(spy_handler2_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler3_execute.mock.invocationCallOrder[0]);
            });

            it('dispatchAll- multiple actions', async () => {
                // Mock setup
                registry_get_stub.mockImplementation(handlerMockImpl);
                // Test execution
                await actionDispatcher.dispatchAll([{ kind: action1 }, { kind: action2 }, { kind: action3 }]);
                // Check if all handlers have been called
                expect(spy_handler1_execute).toHaveBeenCalledOnce();
                expect(spy_handler2_execute).toHaveBeenCalledOnce();
                expect(spy_handler3_execute).toHaveBeenCalledOnce();
                // Check if all handlers have been called in the right order
                expect(spy_handler1_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler2_execute.mock.invocationCallOrder[0]);
                expect(spy_handler2_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler3_execute.mock.invocationCallOrder[0]);
            });

            it('dispatch - multiple actions (racing execution times)', async () => {
                // Mock setup
                registry_get_stub.mockImplementation(handlerMockImpl);
                spy_handler1_execute.mockImplementation((_action: Action) => {
                    waitSync(500);
                    return [];
                });
                spy_handler2_execute.mockImplementation((_action: Action) => {
                    waitSync(200);
                    return [];
                });
                spy_handler3_execute.mockImplementation((_action: Action) => {
                    waitSync(100);
                    return [];
                });
                // Test execution
                actionDispatcher.dispatch({ kind: action1 });
                actionDispatcher.dispatch({ kind: action2 });
                await actionDispatcher.dispatch({ kind: action3 });
                // Check if all handlers have been called
                expect(spy_handler1_execute).toHaveBeenCalledOnce();
                expect(spy_handler2_execute).toHaveBeenCalledOnce();
                expect(spy_handler3_execute).toHaveBeenCalledOnce();
                // Check if all handlers have been called in the right order
                expect(spy_handler1_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler2_execute.mock.invocationCallOrder[0]);
                expect(spy_handler2_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler3_execute.mock.invocationCallOrder[0]);
            });
        });

        it('dispatch- one action & multiple handlers', async () => {
            // Mock setup
            const action1 = 'a1';

            const handler1 = new mock.StubActionHandler([action1]);
            const handler2 = new mock.StubActionHandler([action1]);

            registry_get_stub.mockImplementation((kind: string) => (kind === action1 ? [handler1, handler2] : []));
            const spy_handler1_execute = vi.spyOn(handler1, 'execute');
            const spy_handler2_execute = vi.spyOn(handler2, 'execute');
            // Test execution
            await actionDispatcher.dispatch({ kind: action1 });
            expect(spy_handler1_execute).toHaveBeenCalledOnce();
            expect(spy_handler2_execute).toHaveBeenCalledOnce();
            expect(spy_handler1_execute.mock.invocationCallOrder[0]).toBeLessThan(spy_handler2_execute.mock.invocationCallOrder[0]);
        });
    });

    describe('test with handler response actions ', () => {
        it('dispatch - one action & one handler response action', async () => {
            // Mock setup
            const request = 'request';
            const response = 'response';

            const requestHandler = new mock.StubActionHandler([request]);
            const responseHandler = new mock.StubActionHandler([response]);

            const spy_requestHandler_execute = vi.spyOn(requestHandler, 'execute').mockReturnValue([{ kind: response }]);
            const spy_responseHandler_execute = vi.spyOn(responseHandler, 'execute');
            registry_get_stub.mockImplementation((kind: string) => {
                switch (kind) {
                    case request:
                        return [requestHandler];
                    case response:
                        return [responseHandler];
                    default:
                        return [];
                }
            });
            // Test execution
            await actionDispatcher.dispatch({ kind: request });
            // Add a delay so that the action dispatcher has time to dispatch the handler response
            await mock.delay(200);
            // Check if all handlers have been called
            expect(spy_requestHandler_execute).toHaveBeenCalledOnce();
            expect(spy_responseHandler_execute).toHaveBeenCalledOnce();
        });

        it('dispatch - multiple actions & multiple response', async () => {
            // Mock setup
            const request1 = 'request1';
            const request2 = 'request2';
            const response1 = 'response1';
            const response2 = 'response2';

            const responseHandler1 = new mock.StubActionHandler([response1]);
            const responseHandler2 = new mock.StubActionHandler([response2]);
            const requestHandler1 = new mock.StubActionHandler([request1]);
            const requestHandler2 = new mock.StubActionHandler([request2]);

            const spy_requestHandler1_execute = vi
                .spyOn(requestHandler1, 'execute')
                .mockReturnValue([{ kind: response1 }, { kind: response2 }]);
            const spy_requestHandler2_execute = vi.spyOn(requestHandler2, 'execute').mockReturnValue([{ kind: response2 }]);
            const spy_responseHandler1_execute = vi.spyOn(responseHandler1, 'execute');
            const spy_responseHandler2_execute = vi.spyOn(responseHandler2, 'execute');
            registry_get_stub.mockImplementation((kind: string) => {
                switch (kind) {
                    case request1:
                        return [requestHandler1];
                    case request2:
                        return [requestHandler2];
                    case response1:
                        return [responseHandler1, responseHandler2];
                    case response2:
                        return [responseHandler2];
                    default:
                        return [];
                }
            });
            // Test execution
            actionDispatcher.dispatch({ kind: request1 });
            await actionDispatcher.dispatch({ kind: request2 });

            // Add a delay so that the action dispatcher has time to dispatch the handler response
            await mock.delay(100);
            // Check if all handlers have been called correctly
            expect(spy_requestHandler1_execute).toHaveBeenCalledOnce();
            expect(spy_requestHandler2_execute).toHaveBeenCalledOnce();
            expect(spy_responseHandler1_execute).toHaveBeenCalledOnce();
            expect(spy_responseHandler2_execute).toHaveBeenCalledTimes(3);
            // Check if all handlers have been called in the right order
            expect(spy_requestHandler1_execute.mock.invocationCallOrder[0]).toBeLessThan(
                spy_requestHandler2_execute.mock.invocationCallOrder[0]
            );
            expect(spy_responseHandler1_execute.mock.invocationCallOrder[0]).toBeLessThan(
                spy_responseHandler2_execute.mock.invocationCallOrder[0]
            );
        });
    });

    describe('test dispatch after next update', () => {
        it('dispatchAfterNextUpdate', async () => {
            // Mock setup
            const updateModelAction = UpdateModelAction.create({ id: 'newRoot', type: 'myType' });
            const intermediateAction = 'intermediate';
            const postUpdateAction = 'postUpdate';
            const handler = new mock.StubActionHandler([updateModelAction.kind, intermediateAction]);
            const postUpdateHandler = new mock.StubActionHandler([postUpdateAction]);

            const getHandler = (kind: string): ActionHandler[] => {
                if (kind === updateModelAction.kind || kind === intermediateAction) {
                    return [handler];
                } else if (kind === postUpdateAction) {
                    return [postUpdateHandler];
                }

                return [];
            };
            registry_get_stub.mockImplementation(getHandler);
            const spy_postUpdateHandler_execute = vi.spyOn(postUpdateHandler, 'execute');

            // Test execution
            actionDispatcher.dispatchAfterNextUpdate({ kind: postUpdateAction });
            expect(spy_postUpdateHandler_execute).not.toHaveBeenCalled();
            await actionDispatcher.dispatch({ kind: intermediateAction });
            expect(spy_postUpdateHandler_execute).not.toHaveBeenCalled();
            await actionDispatcher.dispatch(updateModelAction);
            expect(spy_postUpdateHandler_execute).toHaveBeenCalledOnce();
            // Check that action does not get dispatched again
            await actionDispatcher.dispatch(updateModelAction);
            expect(spy_postUpdateHandler_execute).toHaveBeenCalledOnce();
        });
    });

    describe('test request/response', () => {
        it('request - resolves when matching response is dispatched', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_1'
            };
            const responseAction: ResponseAction = {
                kind: 'testResponse',
                responseId: 'req_1'
            };

            // Configure forwarder: testRequest is forwarded to the client
            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            registry_get_stub.mockImplementation(() => []);

            const responsePromise = actionDispatcher.request(requestAction);
            await actionDispatcher.dispatch(responseAction);

            const result = await responsePromise;
            expect(result.responseId).toBe('req_1');
        });

        it('request - response bypasses queue even when queue is busy', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_deadlock'
            };
            const responseAction: ResponseAction = {
                kind: 'testResponse',
                responseId: 'req_deadlock'
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');

            const handlerRunning = new Deferred<void>();

            const slowAction = 'slowAction';
            const slowHandler = new mock.StubActionHandler([slowAction]);
            slowHandler.execute = async () => {
                const resultPromise = actionDispatcher.request(requestAction);
                handlerRunning.resolve();
                const result = await resultPromise;
                expect(result.responseId).toBe('req_deadlock');
                return [];
            };
            registry_get_stub.mockImplementation((kind: string) => (kind === slowAction ? [slowHandler] : []));

            const dispatchPromise = actionDispatcher.dispatch({ kind: slowAction });
            await handlerRunning.promise;

            // Response must resolve even though the queue is busy
            await actionDispatcher.dispatch(responseAction);
            await dispatchPromise;
        });

        it('request - resolves for locally handled request (server→server)', async () => {
            const localRequestKind = 'localRequest';
            const localResponseKind = 'localResponse';

            const handler = new mock.StubActionHandler([localRequestKind]);
            vi.spyOn(handler, 'execute').mockImplementation(() => {
                const response: ResponseAction = { kind: localResponseKind, responseId: '' };
                return [response];
            });
            registry_get_stub.mockImplementation((kind: string) => (kind === localRequestKind ? [handler] : []));

            const requestAction: RequestAction<ResponseAction> = {
                kind: localRequestKind,
                requestId: ''
            };

            const result = await actionDispatcher.request(requestAction);
            expect(result).toBeDefined();
            expect(result.responseId).toBe(requestAction.requestId);
        });

        it('request - resolves for locally handled request called from inside a handler', async () => {
            const innerRequestKind = 'innerRequest';
            const innerResponseKind = 'innerResponse';
            const outerActionKind = 'outerAction';

            const innerHandler = new mock.StubActionHandler([innerRequestKind]);
            vi.spyOn(innerHandler, 'execute').mockImplementation(() => {
                const response: ResponseAction = { kind: innerResponseKind, responseId: '' };
                return [response];
            });

            const outerHandler = new mock.StubActionHandler([outerActionKind]);
            outerHandler.execute = async () => {
                const innerRequest: RequestAction<ResponseAction> = {
                    kind: innerRequestKind,
                    requestId: ''
                };
                const result = await actionDispatcher.request(innerRequest);
                expect(result).toBeDefined();
                return [];
            };

            registry_get_stub.mockImplementation((kind: string) => {
                if (kind === outerActionKind) return [outerHandler];
                if (kind === innerRequestKind) return [innerHandler];
                return [];
            });

            // This must not deadlock
            await actionDispatcher.dispatch({ kind: outerActionKind });
        });

        it('requestUntil - rejects on timeout when rejectOnTimeout is true', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_hard'
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            registry_get_stub.mockImplementation(() => []);

            try {
                await actionDispatcher.requestUntil(requestAction, 100, true);
                expect.fail('Should have thrown');
            } catch (error: unknown) {
                expect((error as Error).message).toContain('timed out');
            }
        });

        it('requestUntil - resolves undefined on timeout when rejectOnTimeout is false', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_soft'
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            registry_get_stub.mockImplementation(() => []);

            const result = await actionDispatcher.requestUntil(requestAction, 100, false);
            expect(result).toBeUndefined();
        });

        it('request - auto-generates requestId when empty', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: ''
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            registry_get_stub.mockImplementation(() => []);

            const responsePromise = actionDispatcher.request(requestAction);
            expect(requestAction.requestId).toMatch(/^server_.*_\d+$/);

            await actionDispatcher.dispatch({
                kind: 'testResponse',
                responseId: requestAction.requestId
            } as ResponseAction);

            const result = await responsePromise;
            expect(result).toBeDefined();
        });

        it('request - rejects when dispatch fails (no handler, not a client action)', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'unknownRequest',
                requestId: 'req_fail'
            };

            // NOT forwarded to client, no handler registered → dispatch throws
            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockReturnValue(false);
            vi.mocked(clientActionForwarderStub.handle).mockReturnValue(false);
            registry_get_stub.mockImplementation(() => []);

            try {
                await actionDispatcher.request(requestAction);
                expect.fail('Should have thrown');
            } catch (error: unknown) {
                expect((error as Error).message).toContain('No handler registered');
            }
        });

        it('requestUntil - late response after timeout has responseId cleared', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_late'
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            // Register a no-op handler for testResponse so the late response can be dispatched normally
            const noopHandler = new mock.StubActionHandler(['testResponse']);
            registry_get_stub.mockImplementation((kind: string) => (kind === 'testResponse' ? [noopHandler] : []));

            // Request times out
            try {
                await actionDispatcher.requestUntil(requestAction, 50, true);
                expect.fail('Should have thrown');
            } catch (error: unknown) {
                expect((error as Error).message).toContain('timed out');
            }

            // Late response arrives — responseId should be cleared, dispatched as normal action
            const lateResponse: ResponseAction = { kind: 'testResponse', responseId: 'req_late' };
            await actionDispatcher.dispatch(lateResponse);
            expect(lateResponse.responseId).toBe('');
        });

        it('dispatch - drops a stale ResponseAction with no matching pending request and no handler', async () => {
            // Late `RejectAction`s (and any other ResponseAction that arrives after the matching
            // pending request is gone) used to throw "No handler registered" because the dispatcher
            // tried to route them as regular actions. They are protocol signals, not handler
            // invocations — `doDispatch` swallows them with a debug log instead.
            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockReturnValue(false);
            vi.mocked(clientActionForwarderStub.handle).mockReturnValue(false);
            registry_get_stub.mockImplementation(() => []);

            const lateReject = RejectAction.create('late reject', { responseId: 'never-pending' });

            // No throw, no client-forward — the dispatch resolves cleanly.
            await actionDispatcher.dispatch(lateReject);
        });

        it('request - resolves when response intercept happens from inside doDispatch', async () => {
            // A local handler for the request kind returns the matching response action directly.
            // The response is dispatched via dispatchResponses() -> dispatch() and intercepted
            // via the reentrant path (not via the external dispatch() entry).
            const requestKind = 'inlineRequest';
            const responseKind = 'inlineResponse';

            const handler = new mock.StubActionHandler([requestKind]);
            vi.spyOn(handler, 'execute').mockImplementation(() => [{ kind: responseKind, responseId: '' } as ResponseAction]);
            registry_get_stub.mockImplementation((kind: string) => (kind === requestKind ? [handler] : []));

            const requestAction: RequestAction<ResponseAction> = { kind: requestKind, requestId: '' };
            const result = await actionDispatcher.request(requestAction);

            expect(result.responseId).toBe(requestAction.requestId);
        });
    });

    describe('test reentrancy and ordering', () => {
        it('dispatch from within a handler runs inline before the next queued action', async () => {
            const outerKind = 'reentrantOuter';
            const innerKind = 'reentrantInner';
            const followerKind = 'reentrantFollower';

            const events: string[] = [];

            const innerHandler = new mock.StubActionHandler([innerKind]);
            vi.spyOn(innerHandler, 'execute').mockImplementation(() => {
                events.push('inner');
                return [];
            });

            const outerHandler = new mock.StubActionHandler([outerKind]);
            outerHandler.execute = async () => {
                events.push('outer-start');
                await actionDispatcher.dispatch({ kind: innerKind });
                events.push('outer-end');
                return [];
            };

            const followerHandler = new mock.StubActionHandler([followerKind]);
            vi.spyOn(followerHandler, 'execute').mockImplementation(() => {
                events.push('follower');
                return [];
            });

            registry_get_stub.mockImplementation((kind: string) => {
                if (kind === outerKind) return [outerHandler];
                if (kind === innerKind) return [innerHandler];
                if (kind === followerKind) return [followerHandler];
                return [];
            });

            actionDispatcher.dispatch({ kind: outerKind });
            await actionDispatcher.dispatch({ kind: followerKind });

            expect(events).toEqual(['outer-start', 'inner', 'outer-end', 'follower']);
        });

        it('handler response actions are dispatched in order without an ephemeral queue', async () => {
            const requestKind = 'orderedRequest';
            const firstResponse = 'orderedResponse1';
            const secondResponse = 'orderedResponse2';
            const order: string[] = [];

            const requestHandler = new mock.StubActionHandler([requestKind]);
            vi.spyOn(requestHandler, 'execute').mockImplementation(() => [{ kind: firstResponse }, { kind: secondResponse }]);

            const firstHandler = new mock.StubActionHandler([firstResponse]);
            vi.spyOn(firstHandler, 'execute').mockImplementation(async () => {
                await mock.delay(20);
                order.push(firstResponse);
                return [];
            });

            const secondHandler = new mock.StubActionHandler([secondResponse]);
            vi.spyOn(secondHandler, 'execute').mockImplementation(() => {
                order.push(secondResponse);
                return [];
            });

            registry_get_stub.mockImplementation((kind: string) => {
                if (kind === requestKind) return [requestHandler];
                if (kind === firstResponse) return [firstHandler];
                if (kind === secondResponse) return [secondHandler];
                return [];
            });

            await actionDispatcher.dispatch({ kind: requestKind });
            expect(order).toEqual([firstResponse, secondResponse]);
        });
    });

    describe('test dispose', () => {
        it('dispose - rejects all pending requests', async () => {
            const requestAction: RequestAction<ResponseAction> = {
                kind: 'testRequest',
                requestId: 'req_dispose'
            };

            vi.mocked(clientActionForwarderStub.shouldForwardToClient).mockImplementation(action => action.kind === 'testRequest');
            vi.mocked(clientActionForwarderStub.handle).mockImplementation(action => action.kind === 'testRequest');
            registry_get_stub.mockImplementation(() => []);

            const responsePromise = actionDispatcher.request(requestAction);
            actionDispatcher.dispose();

            try {
                await responsePromise;
                expect.fail('Should have thrown');
            } catch (error: unknown) {
                expect((error as Error).message).toContain('cancelled');
                expect((error as Error).message).toContain('req_dispose');
            }
        });

        it('dispose - rejects queued dispatch() promises instead of orphaning them', async () => {
            // Use a fresh dispatcher so the shared one is not affected.
            const localDispatcher = container.resolve(DefaultActionDispatcher);
            const slowKind = 'slowDispose';
            const queuedKind = 'queuedDispose';

            const slowHandler = new mock.StubActionHandler([slowKind]);
            const slowStarted = new Deferred<void>();
            const releaseSlow = new Deferred<void>();
            slowHandler.execute = async () => {
                slowStarted.resolve();
                await releaseSlow.promise;
                return [];
            };

            registry_get_stub.mockImplementation((kind: string) => (kind === slowKind ? [slowHandler] : []));

            const slowPromise = localDispatcher.dispatch({ kind: slowKind });
            await slowStarted.promise;
            const queuedPromise = localDispatcher.dispatch({ kind: queuedKind });

            localDispatcher.dispose();

            try {
                await queuedPromise;
                expect.fail('Queued dispatch should have rejected');
            } catch (error: unknown) {
                expect((error as Error).message).toContain('ActionDispatcher disposed');
            }

            // Let the slow handler finish so the local dispatcher's consumer loop can exit cleanly.
            releaseSlow.resolve();
            await slowPromise;
        });
    });
});
