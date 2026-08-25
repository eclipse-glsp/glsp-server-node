/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
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
import { Deferred, Disposable, Emitter, Event } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as jsonrpc from 'vscode-jsonrpc/node';
import { JsonRpcGLSPServerLauncher } from '../../common/launch/jsonrpc-server-launcher';
import { Logger } from '../../common/utils/logger';

@injectable()
export class SocketServerLauncher extends JsonRpcGLSPServerLauncher<net.TcpSocketConnectOpts> {
    @inject(Logger) protected override logger: Logger;

    protected netServer: net.Server;

    protected listeningAddress = new Deferred<net.AddressInfo>();

    protected onConnectionEmitter = new Emitter<net.Socket>();

    /**
     * Fires for every socket the server accepts, before the JSON-RPC connection is built on it.
     *
     * A listener must not consume the socket. Subscribe before {@link start} to observe the first connection; the
     * subscription outlives an individual launch and is disposed by the caller.
     */
    get onConnection(): Event<net.Socket> {
        return this.onConnectionEmitter.event;
    }

    /**
     * Resolves with the address the server bound to once it is listening, and rejects if it never gets there.
     *
     * Launching with port `0` lets the operating system pick a free port, so the bound address is not necessarily the
     * requested one. Settles once per launch and keeps that value, so use {@link port} for the current state.
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
        const address = this.netServer?.address();
        return address && typeof address !== 'string' ? address.port : undefined;
    }

    protected override registerDisposables(): void {
        super.registerDisposables();
        this.toDispose.push(
            Disposable.create(() => {
                this.netServer.close();
            })
        );
    }

    protected run(opts: net.TcpSocketConnectOpts): Promise<void> {
        this.resetListening();
        this.netServer = net.createServer(socket => this.acceptConnection(socket));

        this.netServer.listen(opts.port, opts.host);
        this.netServer.on('listening', () => this.onListening());
        this.netServer.on('error', error => this.onError(error));
        return new Promise((resolve, reject) => {
            this.netServer.on('close', () => resolve(undefined));
            this.netServer.on('error', error => reject(error));
        });
    }

    /**
     * Takes up a socket the server accepted. Observers are notified before the socket is read from.
     *
     * @param socket The accepted socket.
     */
    protected acceptConnection(socket: net.Socket): void {
        this.onConnectionEmitter.fire(socket);
        this.createServerInstance(this.createConnection(socket));
    }

    /** Arms {@link listening} for a launch, so a settled promise is never handed to the next one. */
    protected resetListening(): void {
        this.listeningAddress = new Deferred<net.AddressInfo>();
        // Nobody is obliged to consume `listening`, so pre-handle the rejection of a launch whose failure is not awaited.
        this.listeningAddress.promise.catch(() => undefined);
    }

    /** Reports the server as ready and resolves {@link listening}, or fails if the bound address cannot be used. */
    protected onListening(): void {
        const addressInfo = this.netServer.address();
        if (!addressInfo) {
            this.failToListen('Could not resolve GLSP Server address info.');
            return;
        }
        if (typeof addressInfo === 'string') {
            this.failToListen(`GLSP Server is unexpectedly listening to pipe or domain socket "${addressInfo}".`);
            return;
        }
        this.logger.info(`The GLSP server is ready to accept new client requests on port: ${addressInfo.port}`);
        // Print a message to the output stream that indicates that the start is completed.
        // This indicates to the client that the server process is ready (in an embedded scenario).
        console.log(this.startupCompleteMessage.concat(addressInfo.port.toString()));
        this.listeningAddress.resolve(addressInfo);
    }

    /**
     * Invoked when the server socket fails, e.g. because the requested port is already in use.
     *
     * @param error The reason the socket failed.
     */
    protected onError(error: Error): void {
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

    protected createConnection(socket: net.Socket): jsonrpc.MessageConnection {
        return jsonrpc.createMessageConnection(new jsonrpc.SocketMessageReader(socket), new jsonrpc.SocketMessageWriter(socket), console);
    }
}
