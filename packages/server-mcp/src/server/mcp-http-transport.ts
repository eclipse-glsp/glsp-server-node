/********************************************************************************
 * Copyright (c) 2025-2026 EclipseSource and others.
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
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SUPPORTED_PROTOCOL_VERSIONS, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Express } from 'express';
import * as express from 'express';
import * as http from 'http';
import { inject, injectable } from 'inversify';
import { AddressInfo } from 'net';
import { randomUUID } from 'node:crypto';
import { LruEventStore } from './lru-event-store';
import { McpServerOptions } from './mcp-options';
import type { FullMcpServerConfiguration } from './mcp-server-launcher';
import { McpSession, McpSessionId, WithSessionId } from './mcp-session';

/**
 * Where this transport can be reached. Network transports populate `url`;
 * future in-process or stdio transports would leave it undefined.
 */
export interface TransportEndpoint {
    url?: string;
    headers?: Record<string, string>;
}

@injectable()
export class McpHttpTransport implements Disposable {
    protected _app?: Express;
    protected _server?: http.Server;
    protected _addressInfo = new Deferred<AddressInfo>();

    protected sessions = new Map<string, StreamableHTTPServerTransport>();
    protected onSessionInitializedEmitter = new Emitter<McpSession>();
    onSessionInitialized = this.onSessionInitializedEmitter.event;
    protected onSessionClosedEmitter = new Emitter<McpSessionId>();
    onSessionClosed = this.onSessionClosedEmitter.event;

    @inject(McpServerOptions) protected serverOptions: McpServerOptions;

    constructor(@inject(Logger) protected logger: Logger) {}

    get app(): Express | undefined {
        return this._app;
    }

    get server(): http.Server | undefined {
        return this._server;
    }

    getAddress(): Promise<AddressInfo> {
        return this._addressInfo.promise;
    }

    async start(config: FullMcpServerConfiguration): Promise<TransportEndpoint> {
        const { route, host, port } = config;
        // `createMcpExpressApp` gives us (a) a base Express app, (b) `express.json()` body
        // parsing — load-bearing; without it `req.body` is undefined and `isInitializeRequest`
        // can't tell init from non-init — and (c) DNS-rebinding host-header validation for
        // the configured allowlist. We forward our `allowedHosts` so the SDK's validator and
        // any explicit policy share one source of truth.
        this._app = createMcpExpressApp({ host, allowedHosts: this.serverOptions.values.allowedHosts });
        // Allow subclasses to install Express middleware (auth, CORS, rate-limiting,
        // request logging) before the MCP routes are registered. Default: origin allowlist.
        this.configureExpressApp(this._app);
        // MCP-Protocol-Version validation runs after subclass middleware so adopter-installed
        // gates (auth, CORS) get first cut, but before the SDK route handlers so an unsupported
        // header rejects with HTTP 400 cleanly per spec.
        this._app.use(route, this.validateProtocolVersionHeader.bind(this));
        this._app.post(route, this.handlePostRequest.bind(this));
        this._app.get(route, this.handleGetRequest.bind(this));
        this._app.delete(route, this.handleDeleteRequest.bind(this));
        this._server = this._app.listen(port, host);
        // Disable the per-request timeout so long-lived SSE GET streams aren't killed during
        // chat idle periods. From Node's perspective an SSE response is a single in-progress
        // request that lasts as long as the client stays connected, so the default 5-minute
        // `requestTimeout` (Node 18.1+) terminates the socket whenever no events flow for
        // ≥5 min — the client surfaces this as `TypeError: terminated`. We rely on the MCP
        // session-id handshake + `onclose` to detect gone clients.
        this._server.requestTimeout = 0;
        this._server.on('listening', () => this.listening());
        // Pre-listen errors (typically `EADDRINUSE`) fire on the http.Server. Without a
        // listener the deferred address never resolves and `start()` hangs; with it we
        // surface an actionable message naming the offending port + the override path.
        this._server.on('error', err => this.handleListenError(err, host, port));
        const addressInfo = await this.getAddress();
        return { url: this.toServerUrl(addressInfo, route) };
    }

    /**
     * Translate a pre-listen failure into an actionable error and reject the address-info
     * deferred so `start()` propagates it to the caller. `EADDRINUSE` gets a tailored hint
     * about overriding via `mcpServer.port`; other codes pass through unchanged.
     */
    protected handleListenError(err: NodeJS.ErrnoException, host: string, port: number): void {
        if (err.code === 'EADDRINUSE') {
            const portLabel = port === 0 ? 'requested address' : `${host}:${port}`;
            this._addressInfo.reject(
                new Error(
                    `MCP server cannot bind ${portLabel}: address already in use. ` +
                        'Pass a different `mcpServer.port` in the GLSP `initialize` call, or omit the port to get a random one.'
                )
            );
            return;
        }
        this._addressInfo.reject(err);
    }

    /**
     * Hook for subclasses to register middleware on the Express app before the MCP routes
     * are mounted. Called once during {@link start}, after the app is created and before
     * `POST` / `GET` / `DELETE` handlers are added.
     *
     * Default behavior: install an Origin allowlist if one is configured. Host-header
     * validation is already wired by the SDK's `createMcpExpressApp` (using the same
     * `allowedHosts` we forward in {@link start}); we don't duplicate it here. Subclasses
     * that override SHOULD `super.configureExpressApp(app)` to keep the origin gate in place;
     * pre-existing security middleware can run before or after by calling super at the
     * appropriate point.
     */
    protected configureExpressApp(app: Express): void {
        const allowedOrigins = this.serverOptions.values.allowedOrigins;
        if (!allowedOrigins) {
            return;
        }
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (origin && !allowedOrigins.includes(origin)) {
                res.status(403).json({ error: `Forbidden: Origin '${origin}' not allowed` });
                return;
            }
            next();
        });
    }

    /**
     * Validate the `MCP-Protocol-Version` header per the Streamable HTTP transport spec.
     * Initialize POSTs negotiate the version in the body — the header isn't expected there.
     * For every other request: absent header → pass through (the spec mandates the server
     * default to `2025-03-26`); present-but-unsupported → respond `400` with a JSON-RPC error
     * envelope so the client knows which versions to retry with.
     */
    protected validateProtocolVersionHeader(req: express.Request, res: express.Response, next: express.NextFunction): void {
        if (req.method === 'POST' && isInitializeRequest(req.body)) {
            return next();
        }
        const headerValue = req.headers['mcp-protocol-version'];
        const version = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        if (version === undefined) {
            return next();
        }
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message:
                        `Unsupported MCP-Protocol-Version: '${version}'. ` +
                        `Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}.`
                },
                id: JSON_RPC_NULL_ID
            });
            return;
        }
        next();
    }

    protected toServerUrl({ address, family, port }: AddressInfo, route: string, protocol = 'http'): string {
        const host = address === '::' || address === '0.0.0.0' ? 'localhost' : family === 'IPv6' ? `[${address}]` : address;
        return `${protocol}://${host}:${port}${route}`;
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
        this.logger.debug(`Handling POST request for session ${client.sessionId}`);
        try {
            await client.handleRequest(req, res, req.body);
        } catch (err: unknown) {
            this.logger.error('Error handling MCP request:', err);
            if (!res.headersSent) {
                res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: JSON_RPC_NULL_ID });
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
            // SDK transport closes the session as part of handleRequest.
            await client.handleRequest(req, res);
        } catch (err: unknown) {
            this.logger.error('Error handling session termination:', err);
            if (!res.headersSent) {
                res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: JSON_RPC_NULL_ID });
            }
        }
    }

    protected getOrCreateClient(req: express.Request, res: express.Response): StreamableHTTPServerTransport | undefined {
        // A brand-new session is born on an initialize POST that doesn't assert a session id.
        // Every other case falls through to `getClient`, which enforces the spec-mandated
        // 400/404 errors — including the case where an initialize POST carries an unknown
        // session id (§ #3 — must not silently mint a replacement).
        if (!getSessionIdHeader(req) && isInitializeRequest(req.body)) {
            return this.createClient();
        }
        return this.getClient(req, res);
    }

    protected getClient(req: express.Request, res: express.Response): StreamableHTTPServerTransport | undefined {
        const sessionId = getSessionIdHeader(req);
        if (!sessionId) {
            // MCP Streamable HTTP § Session Management #2: a non-initialize request without
            // a session id MUST be rejected with HTTP 400.
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                id: JSON_RPC_NULL_ID
            });
            return undefined;
        }
        const client = this.sessions.get(sessionId);
        if (!client) {
            // MCP Streamable HTTP § Session Management #3: requests bearing an unknown or
            // terminated session id MUST be answered with HTTP 404 so the client knows to
            // re-initialize.
            res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: JSON_RPC_NULL_ID
            });
            return undefined;
        }
        return client;
    }

    protected createClient(): StreamableHTTPServerTransport {
        const client = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            // Bounded LRU store so resumability via `Last-Event-ID` works without leaking
            // memory in long-running deployments. Cap configurable via `eventStoreLimit`.
            eventStore: new LruEventStore(this.serverOptions.values.eventStoreLimit, this.logger),
            onsessioninitialized: sessionId => {
                // Store the transport by session ID when session is initialized
                // This avoids race conditions where requests might come in before the session is stored
                this.logger.info(`Session initialized with ID: ${sessionId}`);
                this.sessions.set(sessionId, client);
                this.onSessionInitializedEmitter.fire(client as WithSessionId<StreamableHTTPServerTransport>);
            }
        });
        client.onclose = () => this.closeClient(client.sessionId);
        // Surface transport errors to the GLSP logger. SDK 1.27.1 routes previously-swallowed
        // errors here; without an explicit handler they go undiagnosed.
        client.onerror = err => this.logger.error(`MCP transport error (session ${client.sessionId ?? '<pre-init>'}):`, err);
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
            this.onSessionClosedEmitter.fire(sessionId);
        }
    }

    dispose(): void {
        // Close session transports first so their SSE responses end cleanly. `http.Server.close()`
        // only stops accepting new connections — existing sockets stay open until they drain — so
        // closing the server first would leave streams hanging until the per-session `client.close()`
        // catches up.
        Array.from(this.sessions.values()).forEach(client => client.close());
        this.sessions.clear();
        this._server?.close();
        // Reset transient state so a subsequent `start()` call boots cleanly. Required because
        // the transport is bound `inSingletonScope()` — without the reset, dispose-then-restart
        // (e.g., GLSP server shutdown followed by a fresh `initializeServer`) would reuse the
        // dead `_addressInfo` deferred and the closed Express app.
        this._app = undefined;
        this._server = undefined;
        this._addressInfo = new Deferred<AddressInfo>();
        this.logger.info('Server shutdown complete');
    }
}

/**
 * Read the `mcp-session-id` header. Node's `IncomingHttpHeaders` types unknown headers as
 * `string | string[] | undefined`; if a misbehaving client sends the header twice we pick
 * the first value rather than coercing the array to `"a,b"` and silently failing the lookup.
 */
function getSessionIdHeader(req: express.Request): string | undefined {
    const value = req.headers['mcp-session-id'];
    return Array.isArray(value) ? value[0] : value;
}

/**
 * JSON-RPC 2.0 § 5 mandates `null` for error responses where the request id cannot be
 * determined (e.g., parse errors, batch-level rejection, missing session id). Centralised so
 * the unavoidable `null` literal lives behind one eslint exception instead of many.
 */
// eslint-disable-next-line no-null/no-null
const JSON_RPC_NULL_ID = null;
