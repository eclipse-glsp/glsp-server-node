/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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
import { DisposeClientSessionParameters, InitializeClientSessionParameters, InitializeParameters } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as sinon from 'sinon';
import { GlobalActionProvider } from '../actions/global-action-provider';
import { ClientSessionManager } from '../session/client-session-manager';
import * as mock from '../test/mock-util';
import { Logger } from '../utils/logger';
import { GLSPClientProxy, JsonRpcGLSPClientProxy } from './glsp-client-proxy';
import { DefaultGLSPServer } from './glsp-server';
import { GLSPServerListener } from './glsp-server-listener';
import assert = require('assert');

describe('test DefaultGLSPServer', () => {
    const container = new Container();
    const clientSessionId = 'myClientSession';
    const diagramType = 'myDiagram';
    const applicationId = 'Test';
    const protocolVersion = '1.0.0';
    const serverActionKinds = new Map<string, string[]>();
    serverActionKinds.set(diagramType, ['A1', 'A2']);
    const sessionManager = new mock.StubClientSessionManager();
    const spy_sessionManager_getOrCreate = sinon.spy(sessionManager, 'getOrCreateClientSession');
    const spy_sessionManager_dispose = sinon.spy(sessionManager, 'disposeClientSession');
    const listener1 = new mock.StubGLSPServerListener();
    const spy_listener1_initialize = sinon.spy(listener1, 'serverInitialized');
    const spy_listener1_shutdown = sinon.spy(listener1, 'serverShutDown');
    const listener2 = new mock.StubGLSPServerListener();
    const spy_listener2_initialize = sinon.spy(listener2, 'serverInitialized');
    const spy_listener2_shutdown = sinon.spy(listener2, 'serverShutDown');

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(GLSPClientProxy).toConstantValue(new mock.StubGLSPClientProxy());
            bind(JsonRpcGLSPClientProxy).toConstantValue(new mock.StubGLSPClientProxy());
            bind(ClientSessionManager).toConstantValue(sessionManager);
            bind(GlobalActionProvider).toConstantValue({ clientActionKinds: new Map<string, string[]>(), serverActionKinds });
            bind(GLSPServerListener).toConstantValue(listener1);
        })
    );

    const glspServer = container.resolve(DefaultGLSPServer);

    beforeEach(() => {
        spy_sessionManager_getOrCreate.restore();
        spy_sessionManager_dispose.restore();
        spy_listener1_initialize.restore();
        spy_listener1_shutdown.restore();
        spy_listener2_initialize.restore();
        spy_listener2_shutdown.restore();
    });

    it('Test calls before server initialization (should throw errors)', async () => {
        assert.rejects(() => glspServer.initializeClientSession({ clientSessionId: 'id', diagramType: 'type' }));
        assert.rejects(() => glspServer.disposeClientSession({ clientSessionId: 'id' }));
        assert.throws(() => glspServer.process({ clientId: 'id', action: { kind: 'action' } }));
    });

    it('addListener - add existing listener', () => {
        const originalSize = glspServer['serverListeners'].length;
        glspServer.addListener(listener1);
        expect(glspServer['serverListeners'].length).to.be.equal(originalSize);
    });

    it('addListener - add new listener', () => {
        const originalSize = glspServer['serverListeners'].length;
        glspServer.addListener(listener2);
        expect(glspServer['serverListeners']).to.include(listener2);
        expect(glspServer['serverListeners'].length).to.be.equal(originalSize + 1);
    });

    it('removeListener - remove non-existing listener', () => {
        const originalSize = glspServer['serverListeners'].length;
        glspServer.removeListener({});
        expect(glspServer['serverListeners'].length).to.be.equal(originalSize);
    });

    it('removeListener - remove existing listener', () => {
        const originalSize = glspServer['serverListeners'].length;
        glspServer.removeListener(listener2);
        expect(glspServer['serverListeners'].length).to.be.equal(originalSize - 1);
    });

    it('initialize - with wrong protocol version', async () => {
        const initializeParameters: InitializeParameters = { applicationId, protocolVersion: 'abc' };
        assert.rejects(glspServer.initialize(initializeParameters));
    });

    it('initialize - with correct parameters', async () => {
        const initializeParameters: InitializeParameters = { applicationId, protocolVersion };
        const result = await glspServer.initialize(initializeParameters);
        expect(result.protocolVersion).to.be.equal(protocolVersion);
        expect(result.serverActions[diagramType]).to.be.equal(serverActionKinds.get(diagramType));
        expect(result.serverActions[diagramType]).to.be.equal(serverActionKinds.get(diagramType));
        expect(spy_listener1_initialize.calledWith(glspServer));
        expect(spy_listener2_initialize.notCalled);
    });

    it('initialize - subsequent call with same parameters', async () => {
        const initializeParameters: InitializeParameters = { applicationId, protocolVersion };
        const result = await glspServer.initialize(initializeParameters);
        expect(result.protocolVersion).to.be.equal(protocolVersion);
        expect(result.serverActions[diagramType]).to.be.equal(serverActionKinds.get(diagramType));
        expect(result.serverActions[diagramType]).to.be.equal(serverActionKinds.get(diagramType));
    });

    it('initialize -  subsequent call with other parameters', async () => {
        const initializeParameters = { applicationId: 'someOtherApp', protocolVersion: 'AnotherProtocolVersion' };
        await assert.rejects(() => glspServer.initialize(initializeParameters));
    });

    it('initialize client session', async () => {
        const initializeClientSessionParameters: InitializeClientSessionParameters = {
            clientSessionId,
            diagramType
        };
        await glspServer.initializeClientSession(initializeClientSessionParameters);
        expect(spy_sessionManager_getOrCreate.calledWith(initializeClientSessionParameters));
    });

    it('dispose client session', async () => {
        const disposeClientSessionParameters: DisposeClientSessionParameters = {
            clientSessionId
        };
        await glspServer.disposeClientSession(disposeClientSessionParameters);
        expect(spy_sessionManager_dispose.calledWith(clientSessionId));
    });

    it('shutdown server', async () => {
        glspServer.shutdown();
        expect(spy_listener1_shutdown.calledWith(glspServer));
        expect(spy_listener2_shutdown.notCalled);
    });
});
