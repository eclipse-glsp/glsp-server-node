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
import { Container, ContainerModule } from 'inversify';
import * as mock from '../test/mock-util';
import { Logger } from '../utils/logger';
import { ClientSessionFactory } from './client-session-factory';
import { DefaultClientSessionManager } from './client-session-manager';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('test DefaultClientSessionManager', () => {
    const testSession = mock.createClientSession('myId', 'myDiagram');
    const testSessionListener = new mock.StubClientSessionListener();

    const sessionFactory = new mock.StubClientSessionFactory();
    sinon.stub(sessionFactory, 'create').returns(testSession);

    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(ClientSessionFactory).toConstantValue(sessionFactory);
        })
    );
    const sessionManager = container.resolve(DefaultClientSessionManager);

    it('add listener', () => {
        expect(sessionManager.addListener(testSessionListener, testSession.id)).true;
    });

    it('add create client session', () => {
        // Mock setup
        const listener_create = sinon.spy(testSessionListener, 'sessionCreated');
        // Test execution
        const createdSession = sessionManager.getOrCreateClientSession({
            clientSessionId: testSession.id,
            diagramType: testSession.diagramType
        });
        expect(createdSession).to.not.be.undefined;
        expect(createdSession.id).to.be.equal(testSession.id);
        expect(createdSession.diagramType).to.be.equal(testSession.diagramType);

        const retrievedSession = sessionManager.getSession(testSession.id);
        expect(retrievedSession).to.not.be.undefined;
        expect(retrievedSession).to.be.equal(createdSession);
        expect(listener_create.calledWith(testSession));
    });

    it('get sessions by type', () => {
        const clientSessions = sessionManager.getSessionsByType(testSession.diagramType);
        expect(clientSessions.length).to.be.equal(1);
        expect(clientSessions[0]).to.be.equal(testSession);
    });

    it('get sessions by type that does no exist', async () => {
        const clientSessions = sessionManager.getSessionsByType('wrongType');
        expect(clientSessions.length).to.be.equal(0);
    });

    it('dispose client session', () => {
        // Mock setup
        const listener_dispose = sinon.spy(testSessionListener, 'sessionDisposed');
        // Test execution
        expect(sessionManager.disposeClientSession(testSession.id)).to.be.equal(true);
        const session = sessionManager.getSession(testSession.id);
        expect(session).to.be.undefined;
        expect(listener_dispose.calledWith(testSession));
    });
});
