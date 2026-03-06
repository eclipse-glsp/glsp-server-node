/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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

import { Deferred, Disposable, Emitter, Logger } from '@eclipse-glsp/server';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import type { Express } from 'express';
import * as express from 'express';
import * as http from 'http';
import { injectable } from 'inversify';
import { AddressInfo } from 'net';
import { randomUUID } from 'node:crypto';
import { FullMcpServerConfiguration } from './mcp-server-manager';

export type WithSessionId<T> = T & { get sessionId(): string };

export type McpClientSession = WithSessionId<StreamableHTTPServerTransport>;

@injectable()
export class McpHttpServerWithSessions implements Disposable {
    protected _app?: Express;
    protected _server?: http.Server;
    protected _addressInfo = new Deferred<AddressInfo>();

    protected sessions = new Map<string, StreamableHTTPServerTransport>();
    protected onSessionCreatedEmitter = new Emitter<StreamableHTTPServerTransport>();
    onSessionCreated = this.onSessionCreatedEmitter.event;
    protected onSessionInitializedEmitter = new Emitter<McpClientSession>();
    onSessionInitialized = this.onSessionInitializedEmitter.event;

    constructor(protected logger: Logger) {}

    get app(): Express | undefined {
        return this._app;
    }

    get server(): http.Server | undefined {
        return this._server;
    }

    getAddress(): Promise<AddressInfo> {
        return this._addressInfo.promise;
    }

    start({ route, host, port }: FullMcpServerConfiguration): Promise<AddressInfo> {
        this._app = createMcpExpressApp({ host });
        this._app.post(route, this.handlePostRequest.bind(this));
        this._app.get(route, this.handleGetRequest.bind(this));
        this._app.delete(route, this.handleDeleteRequest.bind(this));
        this._server = this._app.listen(port, host);
        this._server.on('listening', () => this.listening());
        return this.getAddress();
    }

    protected listening(): void {
        const addressInfo = this.server?.address();
        if (!addressInfo) {
            this.logger.error('Could not resolve MCP Server address info. Shutting down.');
            this._server?.close();
            return;
        } else if (typeof addressInfo === 'string') {
            this.logger.error(`MCP Server is unexpectedly listening to pipe or domain socket "${addressInfo}". Shutting down.`);
            this._server?.close();
            return;
        }
        this._addressInfo.resolve(addressInfo);
    }

    protected async handlePostRequest(req: express.Request, res: express.Response): Promise<void> {
        const client = this.getOrCreateClient(req, res);
        if (!client) {
            return;
        }

        this.logger.info(`Handling POST request for session ${client.sessionId}`);
        // Handle the request with existing transport - no need to reconnect
        // The existing transport is already connected to the server
        try {
            await client.handleRequest(req, res, req.body);
        } catch (error) {
            this.logger.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: undefined });
            }
        }
    }

    /**
     * Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
     */
    protected async handleGetRequest(req: express.Request, res: express.Response): Promise<void> {
        const client = this.getClient(req, res);
        if (!client) {
            return;
        }

        // Check for Last-Event-ID header for resumability
        const lastEventId = req.headers['last-event-id'] as string | undefined;
        if (lastEventId) {
            this.logger.info(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
        } else {
            this.logger.info(`Establishing new SSE stream for session ${client.sessionId}`);
        }
        await client.handleRequest(req, res);
    }

    /**
     * Handle DELETE requests for session termination (according to MCP spec).
     */
    protected async handleDeleteRequest(req: express.Request, res: express.Response): Promise<void> {
        const client = this.getClient(req, res);
        if (!client) {
            return;
        }

        this.logger.info(`Received session termination request for session ${client.sessionId}`);
        try {
            // this will close the client
            await client.handleRequest(req, res);
        } catch (error) {
            this.logger.error('Error handling session termination:', error);
            if (!res.headersSent) {
                res.status(500).send('Error processing session termination');
            }
        }
    }

    protected getOrCreateClient(req: express.Request, res: express.Response): StreamableHTTPServerTransport | undefined {
        const client = this.getClient(req);
        if (client) {
            // existing client
            return client;
        }
        if (!isInitializeRequest(req.body)) {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                id: undefined
            });
            return undefined;
        }
        return this.createClient();
    }

    protected getClient(req: express.Request, res?: express.Response): StreamableHTTPServerTransport | undefined {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId) {
            res?.status(400).send('Missing session ID');
            return;
        }
        const client = this.sessions.get(sessionId);
        if (!client) {
            res?.status(404).send('Invalid session ID, no client found.');
            return;
        }
        return client;
    }

    protected createClient(): StreamableHTTPServerTransport {
        const client = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore: new InMemoryEventStore(), // Enable resumability
            onsessioninitialized: sessionId => {
                // Store the transport by session ID when session is initialized
                // This avoids race conditions where requests might come in before the session is stored
                this.logger.info(`Session initialized with ID: ${sessionId}`);
                this.sessions.set(sessionId, client);
                this.onSessionInitializedEmitter.fire(client as WithSessionId<StreamableHTTPServerTransport>);
            }
        });
        client.onclose = () => this.closeClient(client.sessionId);
        this.onSessionCreatedEmitter.fire(client);
        return client;
    }

    protected closeClient(sessionId?: string): void {
        if (!sessionId) {
            return;
        }
        const client = this.sessions.get(sessionId);
        if (client) {
            this.sessions.delete(sessionId);
            client.close();
            this.logger.info(`Closed and removed client with session ID ${sessionId}`);
        }
    }

    dispose(): void {
        this.server?.close();
        Array.from(this.sessions.values()).forEach(client => client.close());
        this.sessions.clear();
        this.logger.info('Server shutdown complete');
    }
}
