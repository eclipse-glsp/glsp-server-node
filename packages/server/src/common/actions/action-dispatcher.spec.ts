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
import { Action, UpdateModelAction } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as sinon from 'sinon';
import { ClientActionKinds, ClientId } from '../di/service-identifiers';
import { ClientSessionManager } from '../session/client-session-manager';
import * as mock from '../test/mock-util';
import { Logger } from '../utils/logger';
import { DefaultActionDispatcher } from './action-dispatcher';
import { ActionHandler } from './action-handler';
import { ActionHandlerRegistry } from './action-handler-registry';
import assert = require('assert');

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
    let registry_get_stub: sinon.SinonStub<[string], ActionHandler[]>;
    const sandbox = sinon.createSandbox();

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(ClientSessionManager).toConstantValue(new mock.StubClientSessionManager());
            bind(ClientId).toConstantValue(clientId);
            bind(ActionHandlerRegistry).toConstantValue(actionHandlerRegistry);
            bind(ClientActionKinds).toConstantValue(['response', 'response1', 'response2']);
        })
    );
    const actionDispatcher = container.resolve(DefaultActionDispatcher);

    beforeEach(() => {
        registry_get_stub = sandbox.stub(actionHandlerRegistry, 'get');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('test with one-way actions (no response actions)', () => {
        it('dispatch- unhandled action', async () => {
            assert.rejects(actionDispatcher.dispatch({ kind: 'unhandled' }));
        });

        it('dispatch - one action', async () => {
            // Mock setup
            const action = 'action';
            const handler = new mock.StubActionHandler([action]);
            const getHandler = (kind: string): ActionHandler[] => (kind === action ? [handler] : []);
            registry_get_stub.callsFake(getHandler);
            const spy_handler_execute = sinon.spy(handler, 'execute');
            // Test execution
            await actionDispatcher.dispatch({ kind: action });
            expect(spy_handler_execute.calledOnce).true;
        });

        describe('test multi dispatch with single-handled actions', () => {
            // Mock Setup
            const action1 = 'a1';
            const action2 = 'a2';
            const action3 = 'a3';

            const handler1 = new mock.StubActionHandler([action1]);
            const handler2 = new mock.StubActionHandler([action2]);
            const handler3 = new mock.StubActionHandler([action3]);

            const spy_handler1_execute = sinon.stub(handler1, 'execute').returns([]);
            const spy_handler2_execute = sinon.stub(handler2, 'execute').returns([]);
            const spy_handler3_execute = sinon.stub(handler3, 'execute').returns([]);
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
                registry_get_stub.callsFake(handlerMockImpl);
                // Test execution
                actionDispatcher.dispatch({ kind: action1 });
                actionDispatcher.dispatch({ kind: action2 });
                await actionDispatcher.dispatch({ kind: action3 });
                // Check if all handlers have been called
                expect(spy_handler1_execute.called).true;
                expect(spy_handler2_execute.called).true;
                expect(spy_handler3_execute.called).true;
                // Check if all handlers have been called in the right order
                sinon.assert.callOrder(spy_handler1_execute, spy_handler2_execute, spy_handler3_execute);
            });

            it('dispatchAll- multiple actions', async () => {
                // Mock setup
                registry_get_stub.callsFake(handlerMockImpl);
                // Test execution
                await actionDispatcher.dispatchAll([{ kind: action1 }, { kind: action2 }, { kind: action3 }]);
                // Check if all handlers have been called
                expect(spy_handler1_execute.calledOnce);
                expect(spy_handler2_execute.calledOnce);
                expect(spy_handler3_execute.calledOnce);
                // Check if all handlers have been called in the right order
                sinon.assert.callOrder(spy_handler1_execute, spy_handler2_execute, spy_handler3_execute);
            });

            it('dispatch - multiple actions (racing execution times)', async () => {
                // Mock setup
                registry_get_stub.callsFake(handlerMockImpl);
                spy_handler1_execute.callsFake((_action: Action) => {
                    waitSync(500);
                    return [];
                });
                spy_handler2_execute.callsFake((_action: Action) => {
                    waitSync(200);
                    return [];
                });
                spy_handler3_execute.callsFake((_action: Action) => {
                    waitSync(100);
                    return [];
                });
                // Test execution
                actionDispatcher.dispatch({ kind: action1 });
                actionDispatcher.dispatch({ kind: action2 });
                await actionDispatcher.dispatch({ kind: action3 });
                // Check if all handlers have been called
                expect(spy_handler1_execute.calledOnce);
                expect(spy_handler2_execute.calledOnce);
                expect(spy_handler3_execute.calledOnce);
                // Check if all handlers have been called in the right order
                sinon.assert.callOrder(spy_handler1_execute, spy_handler2_execute, spy_handler3_execute);
            });
        });

        it('dispatch- one action & multiple handlers', async () => {
            // Mock setup
            const action1 = 'a1';

            const handler1 = new mock.StubActionHandler([action1]);
            const handler2 = new mock.StubActionHandler([action1]);

            registry_get_stub.callsFake((kind: string) => (kind === action1 ? [handler1, handler2] : []));
            const spy_handler1_execute = sinon.spy(handler1, 'execute');
            const spy_handler2_execute = sinon.spy(handler2, 'execute');
            // Test execution
            await actionDispatcher.dispatch({ kind: action1 });
            expect(spy_handler1_execute.calledOnce);
            expect(spy_handler2_execute.calledOnce);
            sinon.assert.callOrder(spy_handler1_execute, spy_handler2_execute);
        });
    });

    describe('test with handler response actions ', () => {
        it('dispatch - one action & one handler response action', async () => {
            // Mock setup
            const request = 'request';
            const response = 'response';

            const requestHandler = new mock.StubActionHandler([request]);
            const responseHandler = new mock.StubActionHandler([response]);

            const spy_requestHandler_execute = sinon.stub(requestHandler, 'execute').returns([{ kind: response }]);
            const spy_responseHandler_execute = sinon.spy(responseHandler, 'execute');
            registry_get_stub.callsFake((kind: string) => {
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
            expect(spy_requestHandler_execute.calledOnce);
            expect(spy_responseHandler_execute.calledOnce);
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

            const spy_requestHandler1_execute = sinon.stub(requestHandler1, 'execute').returns([{ kind: response1 }, { kind: response2 }]);
            const spy_requestHandler2_execute = sinon.stub(requestHandler2, 'execute').returns([{ kind: response2 }]);
            const spy_responseHandler1_execute = sinon.spy(responseHandler1, 'execute');
            const spy_responseHandler2_execute = sinon.spy(responseHandler2, 'execute');
            registry_get_stub.callsFake((kind: string) => {
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
            expect(spy_requestHandler1_execute.calledOnce);
            expect(spy_requestHandler2_execute.calledOnce);
            expect(spy_responseHandler1_execute.calledOnce);
            expect(spy_responseHandler2_execute.calledThrice);
            // Check if all handlers have been called in the right order
            sinon.assert.callOrder(spy_requestHandler1_execute, spy_requestHandler2_execute);
            sinon.assert.callOrder(spy_responseHandler1_execute, spy_responseHandler2_execute);
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
            registry_get_stub.callsFake(getHandler);
            const spy_postUpdateHandler_execute = sinon.spy(postUpdateHandler, 'execute');

            // Test execution
            actionDispatcher.dispatchAfterNextUpdate({ kind: postUpdateAction });
            expect(spy_postUpdateHandler_execute.called).to.be.false;
            await actionDispatcher.dispatch({ kind: intermediateAction });
            expect(spy_postUpdateHandler_execute.called).to.be.false;
            await actionDispatcher.dispatch(updateModelAction);
            expect(spy_postUpdateHandler_execute.calledOnce);
            // Check that action does not get dispatched again
            await actionDispatcher.dispatch(updateModelAction);
            expect(spy_postUpdateHandler_execute.calledOnce);
        });
    });
});
