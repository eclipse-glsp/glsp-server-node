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
import { ActionDispatcher } from '../actions/action-dispatcher';
import { DiagramModules, InjectionContainer } from '../di/service-identifiers';
import { GLSPClientProxy } from '../protocol/glsp-client-proxy';
import * as mock from '../test/mock-util';
import { GLSPServerError } from '../utils/glsp-server-error';
import { Logger } from '../utils/logger';
import { DefaultClientSessionFactory } from './client-session-factory';
import { ClientSessionInitializer } from './client-session-initializer';
import { expect } from 'chai';

describe('test DefaultClientSessionFactory', () => {
    const clientSessionId = 'myClientId';
    const diagramType = 'myDiagramType';
    const container = new Container();
    const diagramModule = new ContainerModule(bind => {
        bind(ActionDispatcher).toConstantValue(new mock.StubActionDispatcher());
        bind(ClientSessionInitializer).toConstantValue(new mock.StubClientSessionInitializer());
    });

    const diagramModules = new Map<string, ContainerModule[]>();
    diagramModules.set(diagramType, [diagramModule]);

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(InjectionContainer).toConstantValue(container);
            bind(DiagramModules).toConstantValue(diagramModules);
            bind(GLSPClientProxy).toConstantValue(new mock.StubGLSPClientProxy());
        })
    );
    const factory = container.resolve(DefaultClientSessionFactory);

    it('create - new client session', () => {
        const session = factory.create({ clientSessionId, diagramType });
        expect(session.id).to.be.equal(clientSessionId);
        expect(session.diagramType).to.be.equal(diagramType);
        expect(session.container.parent).to.be.equal(container);
        expect(session.actionDispatcher instanceof mock.StubActionDispatcher).true;
    });

    it('create - unknown diagram type', () => {
        expect(() => factory.create({ clientSessionId, diagramType: 'unknown-type' })).to.throw(GLSPServerError);
    });
});
