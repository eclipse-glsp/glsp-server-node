/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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

import { Container, injectable } from 'inversify';
import * as jsonrpc from 'vscode-jsonrpc/browser';
import { GLSPServer, GLSPServerLauncher, JsonRpcGLSPServer, MaybePromise, START_UP_COMPLETE_MSG } from '../../common/index';

@injectable()
export class WorkerServerLauncher extends GLSPServerLauncher {
    private connection?: jsonrpc.MessageConnection;

    protected run(): MaybePromise<void> {
        if (this.connection) {
            throw new Error('Error during launch. Server already has an active client connection');
        }
        const container = this.createContainer();
        this.connection = this.createConnection();
        const glspServer = container.get<JsonRpcGLSPServer>(JsonRpcGLSPServer);
        glspServer.connect(this.connection);
        this.connection.onDispose(() => this.disposeClientConnection(container, glspServer));

        this.logger.info('GLSP server worker connection established');
        this.connection.listen();
        postMessage(START_UP_COMPLETE_MSG);
        return new Promise((resolve, rejects) => {
            this.connection?.onClose(() => resolve(undefined));
            this.connection?.onError(error => rejects(error));
        });
    }

    protected disposeClientConnection(container: Container, glspServer: GLSPServer): void {
        glspServer.shutdown();
        container.unbindAll();
        this.connection = undefined;
    }

    protected stop(): MaybePromise<void> {
        this.logger.info('Shutdown WorkerServerLauncher');
        this.connection?.dispose();
    }

    protected createConnection(): jsonrpc.MessageConnection {
        return jsonrpc.createMessageConnection(new jsonrpc.BrowserMessageReader(self), new jsonrpc.BrowserMessageWriter(self));
    }
}
