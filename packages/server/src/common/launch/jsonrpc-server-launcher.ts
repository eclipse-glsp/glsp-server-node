/********************************************************************************
 * Copyright (c) 2023-2026 EclipseSource and others.
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
    Deferred,
    Disposable,
    GLSPClientProxy,
    GLSPServer,
    JsonrpcClientProxy,
    JsonrpcGLSPClient,
    configureClientConnection
} from '@eclipse-glsp/protocol';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import * as net from 'net';
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

    protected listeningAddress = new Deferred<net.AddressInfo>();

    /**
     * Resolves with the address the server bound to once it is listening, and rejects if it never gets there.
     *
     * Launching with port `0` lets the operating system pick a free port, so the bound address is not necessarily the
     * requested one. Settles once per launch and keeps that value, so use {@link port} for the current state. Reading
     * this before {@link start} is fine, the promise handed out is the one that launch settles.
     */
    get listening(): Promise<net.AddressInfo> {
        return this.listeningAddress.promise;
    }

    /**
     * The port the server is currently listening on, or `undefined` if it is not.
     *
     * Await {@link listening} rather than polling this while the server is still starting up.
     */
    get port(): number | undefined {
        const address = this.getServerSocket()?.address();
        return address && typeof address !== 'string' ? address.port : undefined;
    }

    /**
     * The socket that {@link port} reports on, or `undefined` before the first launch.
     *
     * A launcher that binds a socket overrides this, the default reports no address at all.
     */
    protected getServerSocket(): net.Server | undefined {
        return undefined;
    }

    /**
     * Arms {@link listening} for a launch.
     *
     * An unresolved promise is kept, so a caller that grabbed {@link listening} before {@link start} gets the one this
     * launch settles. A settled one is replaced, so a restart is not handed the previous result.
     */
    protected resetListening(): void {
        if (this.listeningAddress.state !== 'unresolved') {
            this.listeningAddress = new Deferred<net.AddressInfo>();
        }
    }

    /**
     * Resolves {@link listening} with the address the given server bound to.
     *
     * @param server The server that reported itself as listening.
     * @returns The bound address, or `undefined` if it cannot be used, in which case the launcher is shut down.
     */
    protected settleListening(server: net.Server): net.AddressInfo | undefined {
        const addressInfo = server.address();
        if (!addressInfo) {
            this.failToListen('Could not resolve GLSP Server address info.');
            return undefined;
        }
        if (typeof addressInfo === 'string') {
            this.failToListen(`GLSP Server is unexpectedly listening to pipe or domain socket "${addressInfo}".`);
            return undefined;
        }
        this.listeningAddress.resolve(addressInfo);
        return addressInfo;
    }

    /**
     * Invoked when the server socket fails, e.g. because the requested port is already in use.
     *
     * @param error The reason the socket failed.
     */
    protected handleError(error: Error): void {
        this.failToListen(`GLSP server socket error. ${error.message}`, error);
    }

    /**
     * Reports that the server will not accept requests, rejects {@link listening} and shuts the launcher down.
     *
     * @param message The reason the server is not usable.
     * @param cause   The underlying error, if the reason was one.
     */
    protected failToListen(message: string, cause?: Error): void {
        this.logger.error(`${message} Shutting down.`);
        this.listeningAddress.reject(cause ?? new Error(message));
        this.shutdown();
    }

    protected override registerDisposables(): void {
        super.registerDisposables();
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
        // A connection may be unceremoniously be closed (e.g., closing/reloading the browser) in which
        // case the server must still be disposed
        serverInstance.clientConnection.onClose(() => this.disposeServerInstance(serverInstance));

        this.logger.info('Starting GLSP server connection');
    }

    protected createClientProxy(serverInstance: JsonRpcServerInstance): GLSPClientProxy {
        const proxy = serverInstance.container.resolve(JsonrpcClientProxy);
        proxy.initialize(serverInstance.clientConnection);
        return proxy;
    }
}
