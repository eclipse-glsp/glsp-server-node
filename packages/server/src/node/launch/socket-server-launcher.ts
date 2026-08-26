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
import { Disposable, Emitter } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as jsonrpc from 'vscode-jsonrpc/node';
import { JsonRpcGLSPServerLauncher } from '../../common/launch/jsonrpc-server-launcher';
import { Logger } from '../../common/utils/logger';

@injectable()
export class SocketServerLauncher extends JsonRpcGLSPServerLauncher<net.TcpSocketConnectOpts> {
    @inject(Logger) protected override logger: Logger;

    protected netServer?: net.Server;

    protected onConnectionEmitter = new Emitter<net.Socket>();

    /**
     * Fires for every socket the server accepts, before the JSON-RPC connection is built on it.
     *
     * A listener must not consume the socket. Subscribe before {@link start} to observe the first connection; the
     * subscription outlives an individual launch and is disposed by the caller.
     */
    readonly onConnection = this.onConnectionEmitter.event;

    protected override getServerSocket(): net.Server | undefined {
        return this.netServer;
    }

    protected override registerDisposables(): void {
        super.registerDisposables();
        this.toDispose.push(
            Disposable.create(() => {
                this.netServer?.close();
            })
        );
    }

    protected run(opts: net.TcpSocketConnectOpts): Promise<void> {
        this.resetListening();
        const netServer = net.createServer(socket => this.acceptConnection(socket));
        this.netServer = netServer;

        netServer.listen(opts.port, opts.host);
        netServer.on('listening', () => this.handleListening(netServer));
        netServer.on('error', error => this.handleError(error));
        return new Promise((resolve, reject) => {
            netServer.on('close', () => resolve(undefined));
            netServer.on('error', error => reject(error));
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

    /**
     * Reports the server as ready and resolves {@link listening}.
     *
     * @param server The server that reported itself as listening.
     */
    protected handleListening(server: net.Server): void {
        const addressInfo = this.settleListening(server);
        if (!addressInfo) {
            return;
        }
        this.logger.info(`The GLSP server is ready to accept new client requests on port: ${addressInfo.port}`);
        // Print a message to the output stream that indicates that the start is completed.
        // This indicates to the client that the server process is ready (in an embedded scenario).
        console.log(this.startupCompleteMessage.concat(addressInfo.port.toString()));
    }

    protected createConnection(socket: net.Socket): jsonrpc.MessageConnection {
        return jsonrpc.createMessageConnection(new jsonrpc.SocketMessageReader(socket), new jsonrpc.SocketMessageWriter(socket), console);
    }
}
