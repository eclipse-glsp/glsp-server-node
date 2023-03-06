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
import { Container, inject, injectable } from 'inversify';
import * as net from 'net';
import * as jsonrpc from 'vscode-jsonrpc/node';
import { Disposable } from '..';
import { GLSPServerLauncher } from '../../common/launch/glsp-server-launcher';
import { GLSPServer, JsonRpcGLSPServer } from '../../common/protocol/glsp-server';
import { Logger } from '../../common/utils/logger';

export const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed. Accepting requests on port:';

@injectable()
export class SocketServerLauncher extends GLSPServerLauncher<net.TcpSocketConnectOpts> {
    @inject(Logger) protected override logger: Logger;

    protected currentConnections: jsonrpc.MessageConnection[] = [];
    protected startupCompleteMessage = START_UP_COMPLETE_MSG;
    protected netServer: net.Server;

    constructor() {
        super();
        this.toDispose.push(
            Disposable.create(() => {
                this.currentConnections.forEach(connection => connection.dispose());
                this.netServer.close();
            })
        );
    }

    protected run(opts: net.TcpSocketConnectOpts): Promise<void> {
        this.netServer = net.createServer(socket => this.createClientConnection(socket));

        this.netServer.listen(opts.port, opts.host);
        this.netServer.on('listening', () => {
            const addressInfo = this.netServer.address();
            if (!addressInfo) {
                this.logger.error('Could not resolve GLSP Server address info. Shutting down.');
                this.shutdown();
                return;
            } else if (typeof addressInfo === 'string') {
                this.logger.error(`GLSP Server is unexpectedly listening to pipe or domain socket "${addressInfo}". Shutting down.`);
                this.shutdown();
                return;
            }
            const currentPort = addressInfo.port;
            this.logger.info(`The GLSP server is ready to accept new client requests on port: ${currentPort}`);
            // Print a message to the output stream that indicates that the start is completed.
            // This indicates to the client that the server process is ready (in an embedded scenario).
            console.log(this.startupCompleteMessage.concat(currentPort.toString()));
        });
        this.netServer.on('error', () => this.shutdown());
        return new Promise((resolve, reject) => {
            this.netServer.on('close', () => resolve(undefined));
            this.netServer.on('error', error => reject(error));
        });
    }

    protected async createClientConnection(socket: net.Socket): Promise<void> {
        const container = this.createContainer();
        const connection = this.createConnection(socket);
        this.currentConnections.push(connection);
        const glspServer = container.get<JsonRpcGLSPServer>(JsonRpcGLSPServer);
        glspServer.connect(connection);
        this.logger.info(`Starting GLSP server connection for client: '${socket.localAddress}'`);
        connection.listen();
        connection.onDispose(() => this.disposeClientConnection(container, glspServer));
        socket.on('close', () => this.disposeClientConnection(container, glspServer));
        return new Promise((resolve, rejects) => {
            connection.onClose(() => resolve(undefined));
            connection.onError(error => rejects(error));
        });
    }

    protected disposeClientConnection(container: Container, glspServer: GLSPServer): void {
        glspServer.shutdown();
        container.unbindAll();
    }

    protected createConnection(socket: net.Socket): jsonrpc.MessageConnection {
        return jsonrpc.createMessageConnection(new jsonrpc.SocketMessageReader(socket), new jsonrpc.SocketMessageWriter(socket), console);
    }
}
