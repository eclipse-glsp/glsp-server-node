/********************************************************************************
 * Copyright (c) 2022-2024 EclipseSource and others.
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

import { injectable } from 'inversify';
import * as jsonrpc from 'vscode-jsonrpc/browser';
import { JsonRpcGLSPServerLauncher, JsonRpcServerInstance, MaybePromise } from '../../common';
export interface WorkerLaunchOptions {
    context?: Worker;
}

export const WORKER_START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed.';

@injectable()
export class WorkerServerLauncher extends JsonRpcGLSPServerLauncher<WorkerLaunchOptions> {
    protected connection?: jsonrpc.MessageConnection;

    protected run(options: WorkerLaunchOptions): MaybePromise<void> {
        if (this.connection) {
            throw new Error('Error during launch. Server already has an active client connection');
        }
        this.connection = this.createConnection(options);
        this.createServerInstance(this.connection);
        this.logger.info('GLSP server worker connection established');
        postMessage(WORKER_START_UP_COMPLETE_MSG);
        return new Promise((resolve, rejects) => {
            this.connection?.onClose(() => resolve(undefined));
            this.connection?.onError(error => rejects(error));
        });
    }

    protected override disposeServerInstance(instance: JsonRpcServerInstance): void {
        super.disposeServerInstance(instance);
        this.connection = undefined;
    }

    protected createConnection(options: WorkerLaunchOptions): jsonrpc.MessageConnection {
        return jsonrpc.createMessageConnection(
            new jsonrpc.BrowserMessageReader(options.context ?? self),
            new jsonrpc.BrowserMessageWriter(options.context ?? self)
        );
    }
}
