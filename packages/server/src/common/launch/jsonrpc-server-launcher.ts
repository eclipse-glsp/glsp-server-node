/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
    Disposable,
    GLSPClientProxy,
    GLSPServer,
    JsonrpcClientProxy,
    JsonrpcGLSPClient,
    configureClientConnection
} from '@eclipse-glsp/protocol';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import * as jsonrpc from 'vscode-jsonrpc';
import { Logger } from '../utils/logger';
import { GLSPServerLauncher } from './glsp-server-launcher';

export const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed. Accepting requests on port:';

export interface JsonRpcServerInstance {
    server: GLSPServer;
    clientConnection: jsonrpc.MessageConnection;
    container: Container;
}

@injectable()
export abstract class JsonRpcGLSPServerLauncher<T> extends GLSPServerLauncher<T> {
    @inject(Logger)
    protected override logger: Logger;

    protected serverInstances = new Map<jsonrpc.MessageConnection, JsonRpcServerInstance>();
    protected startupCompleteMessage = START_UP_COMPLETE_MSG;

    constructor() {
        super();
        this.toDispose.push(
            Disposable.create(() => {
                this.serverInstances.forEach(instance => this.disposeServerInstance(instance));
            })
        );
    }

    protected disposeServerInstance(instance: JsonRpcServerInstance): void {
        this.serverInstances.delete(instance.clientConnection);
        instance.server.shutdown();
        instance.container.unbindAll();
        instance.clientConnection.dispose();
    }

    protected createServerInstance(clientConnection: jsonrpc.MessageConnection): void {
        const container = this.createContainer(this.createJsonRpcModule(clientConnection));
        const server = container.get<GLSPServer>(GLSPServer);
        const instance = { container, clientConnection, server };
        this.serverInstances.set(clientConnection, instance);
        this.configureClientConnection(instance);
    }

    protected createJsonRpcModule(clientConnection: jsonrpc.MessageConnection): ContainerModule {
        return new ContainerModule(bind => {
            bind(GLSPClientProxy).toDynamicValue(ctx => {
                const proxy = ctx.container.resolve(JsonrpcClientProxy);
                proxy.initialize(clientConnection);
                return proxy;
            });
        });
    }

    protected configureClientConnection(serverInstance: JsonRpcServerInstance): void {
        configureClientConnection(serverInstance.clientConnection, serverInstance.server);

        serverInstance.clientConnection.onNotification(JsonrpcGLSPClient.ShutdownNotification, () =>
            this.disposeServerInstance(serverInstance)
        );

        this.logger.info('Starting GLSP server connection');
    }

    protected createClientProxy(serverInstance: JsonRpcServerInstance): GLSPClientProxy {
        const proxy = serverInstance.container.resolve(JsonrpcClientProxy);
        proxy.initialize(serverInstance.clientConnection);
        return proxy;
    }
}
