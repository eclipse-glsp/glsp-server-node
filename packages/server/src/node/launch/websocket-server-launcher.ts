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

import { createWebSocketConnection, Disposable, MaybePromise, WebSocketWrapper } from '@eclipse-glsp/protocol';
import * as http from 'http';
import { inject, injectable } from 'inversify';
import * as net from 'net';
import * as jsonrpc from 'vscode-jsonrpc';
import { Server, WebSocket } from 'ws';
import { JsonRpcGLSPServerLauncher } from '../../common/launch/jsonrpc-server-launcher';
import { Logger } from '../../common/utils/logger';

export interface WebSocketServerOptions {
    host?: string;
    port?: number;
    path: string;
}

export interface ResolvedWebSocketServerOptions {
    host?: string;
    port: number;
    path: string;
    server: http.Server;
}

export interface WebsocketConnectionData {
    socket: WebSocket;
    connection: jsonrpc.MessageConnection;
}

const STATUS_UPGRADE_REQUIRED = 426;

@injectable()
export class WebSocketServerLauncher extends JsonRpcGLSPServerLauncher<WebSocketServerOptions> {
    @inject(Logger)
    protected override logger: Logger;

    protected server: Server;

    constructor() {
        super();
        this.toDispose.push(
            Disposable.create(() => {
                this.server.close();
            })
        );
    }

    protected async run(options: WebSocketServerOptions): Promise<void> {
        const resolvedOptions = await this.resolveOptions(options);
        this.server = new Server({ server: resolvedOptions.server, path: resolvedOptions.path });
        const endpoint = `ws://${resolvedOptions.host}:${resolvedOptions.port}:${resolvedOptions.path}`;
        this.logger.info(`The GLSP Websocket launcher is ready to accept new client requests on endpoint '${endpoint}'`);
        console.log(this.startupCompleteMessage.concat(resolvedOptions.port.toString()));

        this.server.on('connection', (ws, req) => {
            const connection = this.createConnection(ws);
            this.createServerInstance(connection);
        });

        return new Promise((resolve, reject) => {
            this.server.on('close', () => resolve(undefined));
            this.server.on('error', error => reject(error));
        });
    }

    protected createConnection(socket: WebSocket): jsonrpc.MessageConnection {
        return createWebSocketConnection(wrapWebSocket(socket));
    }

    protected async resolveOptions(options: WebSocketServerOptions): Promise<ResolvedWebSocketServerOptions> {
        const port = !options.port || options.port === 0 ? await getFreePort() : options.port;
        const path = options.path.startsWith('/') ? options.path : `/${options.path}`;
        const server = this.createHttpServer(port, options.host);

        return { ...options, port, path, server };
    }

    protected createHttpServer(port: number, host?: string): http.Server {
        const server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[STATUS_UPGRADE_REQUIRED];

            res.writeHead(426, {
                'Content-Length': body?.length,
                'Content-Type': 'text/plain'
            });
            res.end(body);
        });
        server.listen(port, host);
        // Set server timeout to infinite
        server.setTimeout(0);
        return server;
    }

    override start(options: WebSocketServerOptions): MaybePromise<void> {
        super.start(options);
    }
}

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const address = srv.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Could not address to compute a free port'));
                return;
            }
            srv.close(() => resolve(address.port));
        });
    });
}
/**
 * Creates a {@link WebSocketWrapper} for the given plain WebSocket
 * @param socket The socket to wrap
 */
export function wrapWebSocket(socket: WebSocket): WebSocketWrapper {
    return {
        send: content => socket.send(content),
        onMessage: cb => socket.on('message', cb),
        onClose: cb => socket.on('close', cb),
        onError: cb => socket.on('error', cb),
        dispose: () => socket.close()
    };
}
