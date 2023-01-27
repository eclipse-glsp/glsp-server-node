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
import { ActionMessage, JsonrpcGLSPClient } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import * as jsonrpc from 'vscode-jsonrpc';
import { Logger } from '../utils/logger';

export const GLSPClientProxyFactory = Symbol('GLSPClientProxyFactory');

export type GLSPClientProxyFactory = (connection: jsonrpc.MessageConnection) => GLSPClientProxy;

export const GLSPClientProxy = Symbol('GLSPClientProxy');

/**
 * Json-rpc client proxy interface to hide the underlying json-rpc logic.
 */
export interface GLSPClientProxy {
    /**
     * A `process` notification is sent from the server to server to the client when the client should handle i.e.
     * process a specific {@link ActionMessage}. Any communication that is performed between initialization and shutdown
     * is handled by sending action messages, either from the client to the server or from the server to the client. This
     * is the core part of the Graphical Language Server Protocol.
     *
     * @param message The {@link ActionMessage} that should be processed.
     */
    process(message: ActionMessage): void;
}

export const JsonRpcGLSPClientProxy = Symbol('JsonRpcGLSPClientProxy');

export interface JsonRpcGLSPClientProxy extends GLSPClientProxy {
    connect(connection: jsonrpc.MessageConnection): void;
}

@injectable()
export class DefaultGLSPClientProxy implements JsonRpcGLSPClientProxy {
    @inject(Logger)
    private logger: Logger;

    protected connection: jsonrpc.MessageConnection;

    connect(connection: jsonrpc.MessageConnection): void {
        if (!this.connection) {
            this.connection = connection;
        }
    }

    process(message: ActionMessage): void {
        this.logger.debug(`Send action '${message.action.kind}' to client '${message.clientId}'`);
        this.connection.sendNotification(JsonrpcGLSPClient.ActionMessageNotification, message);
    }
}
