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
import { getDefaultMapping, GNode } from '@eclipse-glsp/graph';
import {
    Args,
    CompoundOperation,
    CreateNodeOperation,
    InitializeResult,
    isRequestBoundsAction,
    Point,
    RequestModelAction
} from '@eclipse-glsp/protocol';
import { Container, ContainerModule, injectable, interfaces } from 'inversify';
import * as path from 'path';
import { GModelDiagramModule } from '../base-impl/gmodel-diagram-module';
import { InstanceMultiBinding } from '../di/multi-binding';
import { ServerModule } from '../di/server-module';
import { InjectionContainer } from '../di/service-identifiers';
import { DiagramConfiguration } from '../diagram/diagram-configuration';
import { SocketServerLauncher } from '../launch/socket-server-launcher';
import { CompoundOperationHandler } from '../operations/compound-operation-handler';
import { CreateNodeOperationHandler } from '../operations/create-operation-handler';
import { OperationHandlerConstructor } from '../operations/operation-handler';
import { OperationHandlerRegistry } from '../operations/operation-handler-registry';
import { GLSPClientProxy, JsonRpcGLSPClientProxy } from '../protocol/glsp-client-proxy';
import { DefaultGLSPServer, GLSPServer } from '../protocol/glsp-server';
import { Logger } from '../utils/logger';
import * as mock from './mock-util';
const applicationId = 'testApp';
const protocolVersion = '0.9.0';
const diagramType = 'testDiagram';
const clientId = 'session1';
const sourceUri = path.resolve(__dirname, 'minimal.json');
import * as sinon from 'sinon';
import { expect } from 'chai';

class TestDiagramModule extends GModelDiagramModule {
    diagramType = diagramType;

    protected configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);
        bind(DiagramConfiguration).toConstantValue(
            new (class extends mock.StubDiagramConfiguration {
                typeMapping = getDefaultMapping();
            })()
        );
    }

    configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(CreateANodeOperationHandler);
    }
}

@injectable()
class CreateANodeOperationHandler extends CreateNodeOperationHandler {
    label = 'ANode';
    elementTypeIds = ['ANode'];

    createNode(relativeLocation: Point | undefined, args: Args | undefined): GNode {
        return new GNode();
    }
}

let serverContainer: Container;
const clientProxy: GLSPClientProxy = new mock.StubGLSPClientProxy();
const spy_client_process = sinon.stub(clientProxy, 'process');
let glspServer: GLSPServer;
let operationHandlerRegistry: OperationHandlerRegistry;

describe('Integration tests for a glsp server created by SocketServerLauncher', () => {
    const parentContainer = new Container();
    parentContainer.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(InjectionContainer).toConstantValue(parentContainer);
        })
    );

    const rebindModule = new ContainerModule((bind, unbind, isBound, rebind) => {
        rebind(GLSPClientProxy).toConstantValue(clientProxy);
        rebind(JsonRpcGLSPClientProxy).toConstantValue(clientProxy);
    });
    const serverModule = new ServerModule().configureDiagramModule(new TestDiagramModule());
    const serverLauncher = parentContainer.resolve(SocketServerLauncher);
    serverLauncher.configure(serverModule, rebindModule);
    serverContainer = serverLauncher.createContainer();
    glspServer = serverContainer.resolve(DefaultGLSPServer);

    let initializeResult: InitializeResult;

    it('process- should fail (server not initialized)', () => {
        expect(() =>
            glspServer.process({
                clientId,
                action: new RequestModelAction({
                    ['sourceUri']: sourceUri
                })
            })
        ).to.throw;
    });

    it('initialize - should return valid initializeResult', async () => {
        initializeResult = await glspServer.initialize({ applicationId, protocolVersion });
        expect(initializeResult.protocolVersion).to.be.equal(protocolVersion);
        const serverActions = initializeResult.serverActions[diagramType];
        expect(serverActions).to.not.be.undefined;
        expect(serverActions.includes(RequestModelAction.KIND)).true;
    });

    it('initialize - subsequent call should return same result', async () => {
        const newResult = await glspServer.initialize({ applicationId, protocolVersion });
        expect(newResult).to.be.equals(initializeResult);
    });

    it('initializeClientSession - should complete successfully', async () => {
        await glspServer.initializeClientSession({ clientSessionId: clientId, diagramType });
        const clientSession = glspServer.getClientSession(clientId)!;
        operationHandlerRegistry = clientSession.container.get(OperationHandlerRegistry);
    });

    it('initializeClientSession - subsequent call should complete successfully', async () => {
        await glspServer.initializeClientSession({ clientSessionId: clientId, diagramType });
    });

    it('process - RequestModelAction should send RequestBoundsAction to client', async () => {
        glspServer.process({ clientId, action: new RequestModelAction({ ['sourceUri']: sourceUri }) });
        // Action handling is done async. We have to add a delay to ensure that we receive all responses
        await mock.delay(200);
        const result = spy_client_process.getCalls().map(call => call.args);
        expect(spy_client_process.calledOnce);
        expect(result[result.length - 1][0].clientId).to.be.equals(clientId);
        expect(isRequestBoundsAction(result[result.length - 2][0].action)).true;
    });

    it('check OperationHandlerRegistry for defined operations', () => {
        expect(operationHandlerRegistry.keys()).to.contain(`${CreateNodeOperation.KIND}_ANode`);
        expect(operationHandlerRegistry.get(`${CreateNodeOperation.KIND}_ANode`)).instanceOf(CreateANodeOperationHandler);
        expect(operationHandlerRegistry.keys()).to.contain(CompoundOperation.KIND);
        expect(operationHandlerRegistry.get(CompoundOperation.KIND)).instanceOf(CompoundOperationHandler);
    });

    it('correct handler is triggered on process', () => {
        const handler = operationHandlerRegistry.get(`${CreateNodeOperation.KIND}_ANode`)!;
        const spy_operationHandler_execute = sinon.stub(handler, 'execute');

        glspServer.process({ clientId, action: new CreateNodeOperation('ANode') });
        expect(spy_operationHandler_execute.calledOnce);
    });
});
