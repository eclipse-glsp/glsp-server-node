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
import {
    ActionMessage,
    Args,
    DisposeClientSessionParameters,
    distinctAdd,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult,
    remove,
    ServerActions,
    ServerMessageAction
} from '@eclipse-glsp/protocol';
import { JsonrpcGLSPClient, MaybePromise } from '@eclipse-glsp/protocol/lib/jsonrpc/glsp-jsonrpc-client';
import { inject, injectable, multiInject, optional } from 'inversify';
import * as jsonrpc from 'vscode-jsonrpc';
import { MessageConnection } from 'vscode-jsonrpc';
import { GlobalActionProvider } from '../actions/global-action-provider';
import { ClientSession } from '../session/client-session';
import { ClientSessionManager } from '../session/client-session-manager';
import { GLSPServerError } from '../utils/glsp-server-error';
import { Logger } from '../utils/logger';
import { JsonRpcGLSPClientProxy } from './glsp-client-proxy';
import { GLSPServerListener } from './glsp-server-listener';

export const GLSPServer = Symbol('GLSPServer');

/**
 * Interface for implementations of a server component using json-rpc for client-server communication.
 * Based on the specification of the Graphical Language Server Protocol:
 * https://github.com/eclipse-glsp/glsp/blob/master/PROTOCOL.md
 */
export interface GLSPServer {
    /**
     *
     * The `initialize` request has to be the first request from the client to the server. Until the server has responded
     * with an {@link InitializeResult} no other request or notification can be handled and is expected to throw an
     * error. A client is uniquely identified by an `applicationId` and has to specify on which `protocolVersion` it is
     * based on. In addition, custom arguments can be provided in the `args` map to allow for custom initialization
     * behavior on the server.
     *
     * After successfully initialization all {@link GLSPServerListener}s are notified via the
     * {@link GLSPServerListener.serverInitialized} method.
     *
     * @param params the {@link InitializeParameters}.
     * @returns A promise of the {@link InitializeResult} .
     *
     * @throws {@link Error} Subsequent initialize requests return the {@link InitializeResult} of the initial request
     * if the given application id and protocol version are matching, otherwise the promise rejects with an error.
     *
     */
    initialize(params: InitializeParameters): Promise<InitializeResult>;

    /**
     * The `initializeClientSession` request is sent to the server whenever a new graphical representation (diagram) is
     * created. Each individual diagram on the client side counts as one session and has to provide a unique
     * `clientSessionId` and its `diagramType`. In addition, custom arguments can be provided in the `args` map to allow
     * for custom initialization behavior on the server. Subsequent `initializeClientSession` requests for the same
     * client id and diagram type are expected to resolve successfully but don't have an actual effect because the
     * corresponding client session is  already initialized.
     *
     * @param params the {@link InitializeClientSessionParameters}.
     * @returns A promise that completes when the initialization was successful.
     */
    initializeClientSession(params: InitializeClientSessionParameters): Promise<void>;

    /**
     * The 'DisposeClientSession' request is sent to the server when a graphical representation (diagram) is no longer
     * needed, e.g. the tab containing the diagram widget has been closed. The session is identified by its unique
     * `clientSessionId`. In addition, custom arguments can be provided in the `args` map to allow for custom dispose
     * behavior on the server.
     *
     * @param params the {@link DisposeClientSessionParameters}.
     * @returns A `void` promise that completes if the disposal was successful.
     *
     */
    disposeClientSession(params: DisposeClientSessionParameters): Promise<void>;

    /**
     * A `process` notification is sent from the client to server when the server should handle i.e. process a specific
     * {@link ActionMessage}. Any communication that is performed between initialization and shutdown is handled by
     * sending action messages, either from the client to the server or from the server to the client. This is the core
     * part of the Graphical Language Server Protocol.
     *
     * @param message The {@link ActionMessage} that should be processed.
     */
    process(message: ActionMessage): void;

    /**
     * The `shutdown` notification is sent from the client to the server if the client disconnects from the server (e.g.
     * the client application has been closed).
     * This gives the server a chance to clean up and dispose any resources dedicated to the client and its sessions.
     * All {@link GLSPServerListener}s are notified via the {@link GLSPServerListener.serverShutDown} method.
     * Afterwards the server instance is considered to be disposed and can no longer be used for handling requests.
     *
     */
    shutdown(): void;

    /**
     * Register a new {@link GLSPServerListener}.
     *
     * @param listener The listener that should be registered.
     * @returns `true` if the listener was registered successfully, `false` otherwise (e.g. listener is already
     *         registered).
     */
    addListener(listener: GLSPServerListener): boolean;

    /**
     * Unregister a {@link GLSPServerListener}.
     *
     * @param listener The listener that should be removed
     * @returns 'true' if the listener was unregistered successfully, `false` otherwise (e.g. listener is was not
     *         registered in the first place).
     */
    removeListener(listener: GLSPServerListener): boolean;

    /**
     * get a {@link ClientSession}.
     *
     * @param sessionId The id of the session to get
     * @returns The either the ClientSession or undefined, if no ClientSession was found for the given id.
     */
    getClientSession(sessionId: string): ClientSession | undefined;
}

export const JsonRpcGLSPServer = Symbol('JsonRpcGLSPServer');

export interface JsonRpcGLSPServer extends GLSPServer {
    connect(connection: jsonrpc.MessageConnection): void;
}

@injectable()
export class DefaultGLSPServer implements JsonRpcGLSPServer {
    public static readonly PROTOCOL_VERSION = '1.0.0';

    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected sessionManager: ClientSessionManager;

    @inject(GlobalActionProvider)
    protected actionProvider: GlobalActionProvider;

    @inject(JsonRpcGLSPClientProxy)
    protected glspClient: JsonRpcGLSPClientProxy;

    protected initializeResult?: InitializeResult;

    protected applicationId: string;

    protected clientSessions: Map<string, ClientSession>;
    protected serverListeners: GLSPServerListener[] = [];

    constructor(@multiInject(GLSPServerListener) @optional() serverListeners: GLSPServerListener[] = []) {
        this.clientSessions = new Map<string, ClientSession>();
        serverListeners.forEach(listener => this.addListener(listener));
    }

    protected setupJsonRpc(connection: MessageConnection): void {
        connection.onRequest(JsonrpcGLSPClient.InitializeRequest.method, (params: InitializeParameters) => this.initialize(params));
        connection.onRequest(JsonrpcGLSPClient.InitializeClientSessionRequest, (params: InitializeClientSessionParameters) =>
            this.initializeClientSession(params)
        );
        connection.onRequest(JsonrpcGLSPClient.DisposeClientSessionRequest, (params: DisposeClientSessionParameters) =>
            this.disposeClientSession(params)
        );
        connection.onNotification(JsonrpcGLSPClient.ActionMessageNotification, message => this.process(message));
        connection.onNotification(JsonrpcGLSPClient.ShutdownNotification, () => this.shutdown());
    }

    protected validateProtocolVersion(params: InitializeParameters): void {
        if (params.protocolVersion !== DefaultGLSPServer.PROTOCOL_VERSION) {
            throw new Error(
                // eslint-disable-next-line max-len
                `Protocol version mismatch! The client protocol version ${params.protocolVersion} is not compatible with the server protocol version ${DefaultGLSPServer.PROTOCOL_VERSION}!`
            );
        }
    }

    protected validateServerInitialized(): void {
        if (!this.isInitialized()) {
            throw new Error('This GLSP server has not been initialized.');
        }
    }

    public async initialize(params: InitializeParameters): Promise<InitializeResult> {
        this.logger.info(`Initializing server with: applicationId: ${params.applicationId}, protocolVersion: ${params.protocolVersion}`);
        this.validateProtocolVersion(params);

        if (this.isInitialized()) {
            if (params.applicationId !== this.applicationId) {
                throw new Error(`Could not initialize GLSP server for application ${params.applicationId}. 
                    Server has already been initialized for different application with id ${this.applicationId}`);
            }
            if (this.initializeResult) {
                return this.initializeResult;
            }
        }

        this.applicationId = params.applicationId;
        const serverActions: ServerActions = {};

        this.actionProvider.serverActionKinds.forEach((kinds, diagramType) => (serverActions[diagramType] = kinds));

        let result = { protocolVersion: DefaultGLSPServer.PROTOCOL_VERSION, serverActions };

        result = await this.handleInitializeArgs(result, params.args);
        this.getListenersToNotify('serverInitialized').forEach((listener: GLSPServerListener) => listener.serverInitialized!(this));
        this.initializeResult = result;
        return result;
    }

    protected handleInitializeArgs(result: InitializeResult, args: Args | undefined): MaybePromise<InitializeResult> {
        return result;
    }

    public async initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        this.logger.info(
            `Initializing client session with: clientSessionId: '${params.clientSessionId}', diagramType: '${params.diagramType}'`
        );
        this.validateServerInitialized();

        const session = this.sessionManager.getOrCreateClientSession(params);
        this.clientSessions.set(params.clientSessionId, session);
        return this.handleInitializeClientSessionArgs(params.args);
    }

    protected handleInitializeClientSessionArgs(args: Args | undefined): MaybePromise<void> {
        return;
    }

    public async disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        this.logger.debug('Dispose client session with:', params);
        this.validateServerInitialized();
        if (this.sessionManager.disposeClientSession(params.clientSessionId)) {
            this.clientSessions.delete(params.clientSessionId);
            return this.handleDisposeClientSessionArgs(params.args);
        }
        return;
    }

    protected async handleDisposeClientSessionArgs(args: Args | undefined): Promise<void> {
        return;
    }

    process(message: ActionMessage): void {
        this.validateServerInitialized();
        this.logger.info(`process [action=${message.action.kind}, clientId=${message.clientId}]`);
        const clientSessionId = message.clientId;
        const clientSession = this.clientSessions.get(clientSessionId);
        if (!clientSession) {
            throw new Error(`No client session has been initialized for client id: ${clientSessionId}`);
        }

        clientSession.actionDispatcher.dispatch(message.action).catch(error => this.handleProcessError(message, error));
    }

    protected handleProcessError(message: ActionMessage, reason: any): void | PromiseLike<void> {
        const errorMsg = `Could not process action: '${message.action.kind}`;
        this.logger.error(errorMsg, reason);
        const details = reason?.cause?.toString() ?? '';
        if (reason instanceof GLSPServerError) {
            const errorAction = ServerMessageAction.create(errorMsg, { severity: 'ERROR', details });
            this.glspClient.process({ clientId: message.clientId, action: errorAction });
        }
    }

    getClientSession(sessionId: string): ClientSession | undefined {
        return this.clientSessions.get(sessionId);
    }

    public shutdown(): void {
        this.logger.info('Shutdown GLSP Server');
        this.getListenersToNotify('serverShutDown').forEach(listener => listener.serverShutDown!(this));
        this.clientSessions.clear();
        this.initializeResult = undefined;
    }

    public connect(connection: jsonrpc.MessageConnection): void {
        this.setupJsonRpc(connection);
        this.glspClient.connect(connection);
    }

    protected isInitialized(): boolean {
        return this.initializeResult !== undefined;
    }

    addListener(listener: GLSPServerListener): boolean {
        distinctAdd(this.serverListeners, listener);
        return true;
    }

    removeListener(listener: GLSPServerListener): boolean {
        remove(this.serverListeners, listener);
        return true;
    }

    protected getListenersToNotify(method: keyof GLSPServerListener): GLSPServerListener[] {
        return this.serverListeners.filter(listener => listener[method]);
    }
}
