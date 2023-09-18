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
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as sinon from 'sinon';
import { DiagramModules, InjectionContainer } from '../di/service-identifiers';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import * as mock from '../test/mock-util';
import { Logger } from '../utils/logger';
import { ActionHandler } from './action-handler';
import { ActionHandlerRegistry } from './action-handler-registry';
import { DefaultGlobalActionProvider } from './global-action-provider';

describe('test DefaultGlobalActionProvider', () => {
    const container = new Container();
    const serverActions = ['A1', 'A2', 'A3'];
    const diagramType = 'myDiagramType';

    const handler1Actions = ['A1', 'A2'];
    const handler2Actions = ['A2', 'A3'];

    const h1 = new mock.StubActionHandler(handler1Actions);
    const h2 = new mock.StubActionHandler(handler2Actions);

    const handlerRegistry = new ActionHandlerRegistry();
    sinon.stub(handlerRegistry, 'getAll').returns([h1, h2]);

    const diagramModule1 = new ContainerModule(bind => {
        bind(ClientSessionInitializer).toConstantValue(new mock.StubClientSessionInitializer());
        bind(ActionHandler).toConstantValue(new mock.StubActionHandler(handler1Actions));
        bind(ActionHandler).toConstantValue(new mock.StubActionHandler(handler2Actions));
        bind(ActionHandlerRegistry).toConstantValue(handlerRegistry);
    });

    const diagramModules = new Map<string, ContainerModule[]>();
    diagramModules.set(diagramType, [diagramModule1]);

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(InjectionContainer).toConstantValue(container);
            bind(DiagramModules).toConstantValue(diagramModules);
        })
    );

    const actionProvider = container.resolve(DefaultGlobalActionProvider);

    it('serverActionsKinds', () => {
        const result = actionProvider.actionKinds;
        expect(result.size).to.be.equal(1);
        const resultServerActions = result.get(diagramType);
        expect(resultServerActions).to.not.be.undefined;
        expect(serverActions.every(action => resultServerActions!.includes(action))).true;
    });
});
