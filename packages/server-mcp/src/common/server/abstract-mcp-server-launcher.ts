/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

import { McpServerOptions as McpServerOptionsType } from '@eclipse-glsp/protocol';
import {
    ClientSessionListener,
    ClientSessionManager,
    Disposable,
    DisposableCollection,
    Emitter,
    GLSPServer,
    GLSPServerInitializer,
    GLSPServerListener,
    InitializeParameters,
    InitializeResult,
    Logger,
    McpInitializeParameters,
    McpInitializeResult,
    McpServerConfiguration,
    McpServerInitOptions
} from '@eclipse-glsp/server';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
    ServerCapabilities,
    SUPPORTED_PROTOCOL_VERSIONS,
    SetLevelRequestSchema,
    isInitializeRequest
} from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable, multiInject, optional } from 'inversify';
import { version as packageVersion } from '../../../package.json';
import { GLSPMcpServer, GLSPMcpServerFactory } from './glsp-mcp-server';
import { LruEventStore } from './lru-event-store';
import { McpDiagramHandlerDispatcher } from './mcp-diagram-handler-dispatcher';
import { McpLogLevelRegistry } from './mcp-log-level-registry';
import { McpServerDefaults, McpServerOptions } from './mcp-options';
import { McpPromptHandler } from './mcp-prompt-handler';
import { McpResourceHandler } from './mcp-resource-handler';
import { McpSession, McpSessionId, WithSessionId } from './mcp-session';
import { McpToolHandler } from './mcp-tool-handler';

/**
 * Server version reported in MCP `initialize` handshake responses (the SDK's `serverInfo.version`
 * field). Sourced from the package's own `package.json` so adopters and clients can tell builds
 * apart without the server author having to remember to bump a literal.
 */
export const SERVER_VERSION: string = packageVersion;

/**
 * Launcher's internal handoff shape: everything from the public {@link McpServerConfiguration}
 * with all fields resolved, plus `host`. `host` is deliberately *not* in the public protocol's
 * init schema — it lives on `McpServerDeployOptions` (deploy-only) rather than
 * `McpServerInitOptions` (init-controllable). The launcher reads it from the adopter-supplied
 * defaults via `McpServerOptions.values.host`.
 */
export type FullMcpServerConfiguration = Omit<Required<McpServerConfiguration>, 'options'> & {
    host: string;
    options: McpServerOptionsType;
};

/**
 * Where this launcher's transport can be reached. Node binders populate `url` (loopback HTTP
 * announcement). The web binder returns `{}` because the adopter wires the handler into its
 * own listener and may not have a routable URL.
 */
export interface TransportEndpoint {
    url?: string;
    headers?: Record<string, string>;
}

/**
 * Per-call options accepted by {@link AbstractMcpServerLauncher.handleRequest}. Adopters wrap
 * their own auth middleware around the handler and forward parsed bearer/JWT/etc. info here.
 */
export interface McpRequestHandlerOptions {
    /** Authenticated principal info — passed through to the SDK so tool handlers can read it via `extra.authInfo`. */
    authInfo?: AuthInfo;
}

/**
 * Defense-in-depth filter for the init-side options payload. The static type already rules out
 * deploy-only fields (`host`, `allowedHosts`, `allowedOrigins`, `acknowledgedNoAuth`) on
 * `McpServerConfiguration.options`, but the wire payload is JSON, so a malformed or malicious
 * client could smuggle extra keys. Destructure-based pick drops anything outside the allowed set
 * so deploy-only fields are sourced *only* from adopter defaults.
 *
 * **Update this allowlist when adding a field to `McpServerInitOptions`** — the destructure
 * below is the single source of truth for which init-side fields cross the wire.
 *
 * Exported for regression-test access only; not part of the public package surface.
 */
export function pickInitOptions(options: McpServerInitOptions): McpServerInitOptions {
    const { dataMode, agentPersona, eventStoreLimit } = options;
    const picked: McpServerInitOptions = {};
    if (dataMode !== undefined) picked.dataMode = dataMode;
    if (agentPersona !== undefined) picked.agentPersona = agentPersona;
    if (eventStoreLimit !== undefined) picked.eventStoreLimit = eventStoreLimit;
    return picked;
}

/**
 * JSON-RPC 2.0 § 5 mandates `null` for error responses where the request id cannot be determined
 * (e.g., parse errors, batch-level rejection, missing session id). Centralized so the unavoidable
 * `null` literal lives behind one eslint exception instead of many.
 */
// eslint-disable-next-line no-null/no-null
const JSON_RPC_NULL_ID = null;

/**
 * Portable, target-neutral MCP server launcher. Owns the per-MCP-session
 * {@link WebStandardStreamableHTTPServerTransport} map, the per-session {@link GLSPMcpServer}
 * registry, handler registration, and the Fetch-shaped `(Request) => Promise<Response>` entry
 * point. Concrete subclasses bind a listener (or no listener) in {@link bindTransport}.
 *
 * **Session state is single-process and in-memory.** Multi-isolate/Durable-Objects adopters
 * need to override the session storage hook in a follow-up.
 *
 * **Authentication** is the adopter's responsibility on non-Node targets — wrap the handler
 * with whatever middleware the deployment requires (bearer, mTLS at proxy, Cloudflare Access,
 * etc.). Node binders run the {@link assertLoopbackOrAcknowledged} guard since they bind the
 * socket themselves.
 */
@injectable()
export abstract class AbstractMcpServerLauncher implements GLSPServerInitializer, GLSPServerListener, Disposable {
    @inject(Logger) protected logger: Logger;

    @inject(McpServerOptions) protected mcpOptions: McpServerOptions;

    @inject(McpServerDefaults) protected mcpDefaults: McpServerDefaults;

    @inject(GLSPMcpServerFactory) protected glspMcpServerFactory: GLSPMcpServerFactory;

    @inject(McpDiagramHandlerDispatcher) protected dispatcher: McpDiagramHandlerDispatcher;

    @inject(McpLogLevelRegistry) protected logLevelRegistry: McpLogLevelRegistry;

    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    @multiInject(McpToolHandler) @optional() protected toolHandlers: McpToolHandler[] = [];

    @multiInject(McpResourceHandler) @optional() protected resourceHandlers: McpResourceHandler[] = [];

    @multiInject(McpPromptHandler) @optional() protected promptHandlers: McpPromptHandler[] = [];

    protected toDispose = new DisposableCollection();
    protected serverUrl: string | undefined;
    protected serverConfig: FullMcpServerConfiguration | undefined;

    /** Per-MCP-session transport — populated on session-init, cleared on session-close. */
    protected readonly sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

    /** Per-MCP-session GLSPMcpServer registry — populated on session-init, cleared on session-close. */
    protected readonly sessionServers = new Map<string, GLSPMcpServer>();

    protected onSessionInitializedEmitter = new Emitter<McpSession>();
    readonly onSessionInitialized = this.onSessionInitializedEmitter.event;
    protected onSessionClosedEmitter = new Emitter<McpSessionId>();
    readonly onSessionClosed = this.onSessionClosedEmitter.event;

    async initializeServer(server: GLSPServer, params: InitializeParameters, result: InitializeResult): Promise<InitializeResult> {
        const mcpServerParam = McpInitializeParameters.getServerConfig(params);
        if (!mcpServerParam) {
            return result;
        }

        // Idempotent: subsequent client sessions of the same GLSP server reuse the existing
        // MCP server. Only the first call binds the listener.
        if (this.serverConfig) {
            if (this.serverUrl) {
                return McpInitializeResult.attachServer(result, { name: this.serverConfig.name, url: this.serverUrl });
            }
            return result;
        }

        const { port = 0, route = '/mcp', name = 'glsp', options = {} } = mcpServerParam;
        const mergedOptions = { ...this.mcpDefaults, ...pickInitOptions(options) };
        this.mcpOptions.values = mergedOptions;
        const host = mergedOptions.host ?? '127.0.0.1';
        const mcpServerConfig: FullMcpServerConfiguration = { port, host, route, name, options: mergedOptions };

        this.dispatcher.harvest();
        this.installResourceListChangedNotifier();

        const endpoint = await this.bindTransport(mcpServerConfig);
        this.serverConfig = mcpServerConfig;
        this.serverUrl = endpoint.url;
        this.logger.info(
            `MCP server '${mcpServerConfig.name}' is ready to accept new client requests on: ${this.serverUrl ?? '(no network endpoint)'}`
        );

        if (endpoint.url) {
            return McpInitializeResult.attachServer(result, {
                name: mcpServerConfig.name,
                url: endpoint.url,
                headers: endpoint.headers
            });
        }
        return result;
    }

    serverShutDown(_server: GLSPServer): void {
        this.dispose();
    }

    dispose(): void {
        // Close transports first so in-flight SSE responses are signalled cleanly. The HTTP
        // listener (registered on `toDispose`) is torn down only after the transport closes
        // settle — closing it earlier would cut the SSE socket mid-flush.
        const closing = Array.from(this.sessions.values()).map(transport =>
            transport.close().catch(err => this.logger.warn(`Error closing MCP session ${transport.sessionId}: ${err}`))
        );
        this.sessions.clear();
        this.sessionServers.forEach(glspMcpServer => glspMcpServer.dispose());
        this.sessionServers.clear();
        Promise.allSettled(closing).then(() => {
            this.toDispose.dispose();
            this.toDispose.clear();
        });
        this.serverUrl = undefined;
        this.serverConfig = undefined;
        this.dispatcher.reset();
    }

    /**
     * Fetch-shaped request entry point. Dispatches POST/GET/DELETE against `config.route`,
     * routing to the right per-session SDK transport. Validates the `MCP-Protocol-Version`
     * header and the spec-mandated session-id rules before handing off to the SDK.
     */
    async handleRequest(req: Request, options?: McpRequestHandlerOptions): Promise<Response> {
        const url = new URL(req.url);
        const route = this.serverConfig?.route ?? '/mcp';
        if (url.pathname !== route) {
            return new Response('Not Found', { status: 404 });
        }
        if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
            return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, GET, DELETE' } });
        }
        const hostError = this.validateHostHeader(req);
        if (hostError) {
            return hostError;
        }

        let parsedBody: unknown | undefined;
        if (req.method === 'POST') {
            // `req.clone()` is mandatory: the body stream can only be read once; the SDK reads the original.
            parsedBody = await req
                .clone()
                .json()
                .catch(() => undefined);
        }

        const isInit = req.method === 'POST' && isInitializeRequest(parsedBody);
        const versionError = this.validateProtocolVersionHeader(req, isInit);
        if (versionError) {
            return versionError;
        }

        const transport = this.resolveTransport(req, isInit);
        if (transport instanceof Response) {
            return transport;
        }
        try {
            return await transport.handleRequest(req, { parsedBody, authInfo: options?.authInfo });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Error handling MCP request:', err);
            return this.jsonRpcErrorResponse(500, -32603, `Internal server error: ${message}`);
        }
    }

    /** Bound `(req) => Promise<Response>` for adopters plugging the handler into any Fetch-shaped listener. */
    getRequestHandler(): (req: Request, options?: McpRequestHandlerOptions) => Promise<Response> {
        return (req, options) => this.handleRequest(req, options);
    }

    /** Concrete subclasses bind their transport (or no-op for runtimes where the adopter owns the listener). */
    protected abstract bindTransport(config: FullMcpServerConfiguration): Promise<TransportEndpoint>;

    /**
     * Resolve the right transport for an incoming request. Returns a {@link Response} for the
     * spec-mandated 400/404 rejections so the caller can early-return.
     */
    protected resolveTransport(req: Request, isInit: boolean): WebStandardStreamableHTTPServerTransport | Response {
        const sessionId = req.headers.get('mcp-session-id') ?? undefined;
        if (isInit && !sessionId) {
            return this.createTransport();
        }
        if (!sessionId) {
            // MCP Streamable HTTP § Session Management #2: non-initialize request without session id → 400.
            return this.jsonRpcErrorResponse(400, -32000, 'Bad Request: No valid session ID provided');
        }
        const existing = this.sessions.get(sessionId);
        if (!existing) {
            // § Session Management #3: unknown or terminated session id → 404.
            return this.jsonRpcErrorResponse(404, -32001, 'Session not found');
        }
        return existing;
    }

    /**
     * Validate the `MCP-Protocol-Version` header per the Streamable HTTP transport spec.
     * Initialize POSTs negotiate the version in the body — the header isn't expected there.
     * For every other request: absent → pass through (server defaults to `2025-03-26`);
     * present-but-unsupported → respond `400` with a JSON-RPC error envelope.
     */
    protected validateProtocolVersionHeader(req: Request, isInit: boolean): Response | undefined {
        if (isInit) {
            return undefined;
        }
        const version = req.headers.get('mcp-protocol-version') ?? undefined;
        if (version === undefined) {
            return undefined;
        }
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
            return this.jsonRpcErrorResponse(
                400,
                -32000,
                `Unsupported MCP-Protocol-Version: '${version}'. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}.`
            );
        }
        return undefined;
    }

    /** Port-agnostic Host validation — `WebStandardStreamableHTTPServerTransport` does exact-string match incl. port. */
    protected validateHostHeader(req: Request): Response | undefined {
        const allowedHosts = this.mcpOptions.values.allowedHosts;
        if (!allowedHosts || allowedHosts.length === 0) {
            return undefined;
        }
        const hostHeader = req.headers.get('host');
        if (!hostHeader) {
            return this.jsonRpcErrorResponse(403, -32000, 'Missing Host header');
        }
        let hostname: string;
        try {
            hostname = new URL(`http://${hostHeader}`).hostname;
        } catch {
            return this.jsonRpcErrorResponse(403, -32000, `Invalid Host header: ${hostHeader}`);
        }
        if (!allowedHosts.includes(hostname)) {
            return this.jsonRpcErrorResponse(403, -32000, `Invalid Host: ${hostname}`);
        }
        return undefined;
    }

    protected createTransport(): WebStandardStreamableHTTPServerTransport {
        const allowedOrigins = this.mcpOptions.values.allowedOrigins;
        const transport = new WebStandardStreamableHTTPServerTransport({
            // `globalThis.crypto` is available on Node 18+, Bun, Deno, Cloudflare Workers, browsers.
            // Avoid `node:crypto` so this file compiles cleanly into a browser bundle.
            sessionIdGenerator: () => globalThis.crypto.randomUUID(),
            eventStore: new LruEventStore(this.mcpOptions.values.eventStoreLimit, this.logger),
            // Host validation lives on `validateHostHeader`.
            allowedOrigins,
            enableDnsRebindingProtection: (allowedOrigins?.length ?? 0) > 0,
            onsessioninitialized: sessionId => {
                this.logger.info(`MCP session initialized with ID: ${sessionId}`);
                this.sessions.set(sessionId, transport);
                if (this.serverConfig) {
                    this.attachServerToSession(transport, this.serverConfig);
                }
                this.onSessionInitializedEmitter.fire(transport as WithSessionId<WebStandardStreamableHTTPServerTransport>);
            },
            onsessionclosed: sessionId => this.closeSession(sessionId)
        });
        transport.onclose = () => this.closeSession(transport.sessionId);
        transport.onerror = err => this.logger.error(`MCP transport error (session ${transport.sessionId ?? '<pre-init>'}):`, err);
        return transport;
    }

    protected attachServerToSession(transport: WebStandardStreamableHTTPServerTransport, config: FullMcpServerConfiguration): void {
        const sessionId = transport.sessionId;
        if (!sessionId) {
            return;
        }
        const glspMcpServer = this.createGlspMcpServer(config);
        this.sessionServers.set(sessionId, glspMcpServer);
        this.registerLogLevelHandler(glspMcpServer, sessionId);
        glspMcpServer.connect(transport as McpSession);
    }

    protected closeSession(sessionId: string | undefined): void {
        if (!sessionId) {
            return;
        }
        const existed = this.sessions.delete(sessionId);
        const glspMcpServer = this.sessionServers.get(sessionId);
        if (glspMcpServer) {
            this.sessionServers.delete(sessionId);
            this.logLevelRegistry.clear(sessionId);
            glspMcpServer.dispose();
        }
        if (existed) {
            this.logger.info(`MCP session closed: ${sessionId}`);
            this.onSessionClosedEmitter.fire(sessionId);
        }
    }

    /**
     * Fire `notifications/resources/list_changed` to every connected MCP client when a GLSP
     * session opens or closes — diagram-scope resources aggregate across GLSP sessions, so the
     * visible list mutates with that lifecycle. No-op when no diagram-scope resources are bound.
     */
    protected installResourceListChangedNotifier(): void {
        if (!this.dispatcher.hasDiagramResources()) {
            return;
        }
        const listener: ClientSessionListener = {
            sessionCreated: () => this.broadcastResourceListChanged(),
            sessionDisposed: () => this.broadcastResourceListChanged()
        };
        this.clientSessionManager.addListener(listener);
        this.toDispose.push(Disposable.create(() => this.clientSessionManager.removeListener(listener)));
    }

    /** Best-effort fan-out — failures on individual MCP sessions (e.g. transport mid-close) are swallowed. */
    protected broadcastResourceListChanged(): void {
        for (const glspMcpServer of this.sessionServers.values()) {
            glspMcpServer
                .getRawServer()
                .server.sendResourceListChanged()
                .catch(err => this.logger.debug('sendResourceListChanged failed:', err));
        }
    }

    /** Register `logging/setLevel` so a connected MCP client can adjust its message severity threshold. */
    protected registerLogLevelHandler(glspMcpServer: GLSPMcpServer, sessionId: string): void {
        glspMcpServer.getRawServer().server.setRequestHandler(SetLevelRequestSchema, async request => {
            this.logLevelRegistry.setLevel(sessionId, request.params.level);
            return {};
        });
    }

    protected createGlspMcpServer({ name, options }: FullMcpServerConfiguration): GLSPMcpServer {
        const resourcesAsResources = options.dataMode === 'resources';
        const server = new McpServer(
            { name, version: SERVER_VERSION },
            {
                capabilities: this.buildCapabilities(resourcesAsResources),
                instructions: options.agentPersona
            }
        );
        const glspMcpServer = this.glspMcpServerFactory(server, options);
        this.registerHandlers(glspMcpServer, resourcesAsResources);
        return glspMcpServer;
    }

    /**
     * Build the MCP capabilities map from what is actually bound. Only declare a key when at
     * least one handler contributes — declaring a capability the SDK never registers a handler
     * for produces `-32601 Method not found` on `<cap>/list`. Resources surfaced as tools
     * (`dataMode === 'tools'`) count toward `tools`, not `resources`.
     */
    protected buildCapabilities(resourcesAsResources: boolean): ServerCapabilities {
        const hasStaticTools = this.toolHandlers.length > 0;
        const hasStaticPrompts = this.promptHandlers.length > 0;
        const hasStaticResources = this.resourceHandlers.length > 0;
        const hasDiagramTools = this.dispatcher.hasDiagramTools();
        const hasDiagramPrompts = this.dispatcher.hasDiagramPrompts();
        const hasDiagramResources = this.dispatcher.hasDiagramResources();
        const anyResources = hasStaticResources || hasDiagramResources;

        const hasTools = hasStaticTools || hasDiagramTools || (!resourcesAsResources && anyResources);
        const hasPrompts = hasStaticPrompts || hasDiagramPrompts;
        const hasResources = resourcesAsResources && anyResources;

        return {
            logging: {},
            ...(hasTools ? { tools: { listChanged: false } } : {}),
            ...(hasResources ? { resources: { listChanged: hasDiagramResources } } : {}),
            ...(hasPrompts ? { prompts: { listChanged: false } } : {})
        };
    }

    protected registerHandlers(glspMcpServer: GLSPMcpServer, resourcesAsResources: boolean): void {
        this.toolHandlers.forEach(handler => handler.registerTool(glspMcpServer));
        this.promptHandlers.forEach(handler => handler.registerPrompt(glspMcpServer));
        if (resourcesAsResources) {
            this.resourceHandlers.forEach(handler => handler.registerResource(glspMcpServer));
        } else {
            this.resourceHandlers.forEach(handler => handler.registerToolAlternative?.(glspMcpServer));
        }

        this.dispatcher.registerAll(glspMcpServer, resourcesAsResources);
        this.validatePromptToolReferences(glspMcpServer);
    }

    /**
     * Warn when a server-scope prompt references a tool that isn't registered on this MCP session
     * — catches adopters who unbind a tool a shipped prompt mentions via `${OtherHandler.NAME}`.
     */
    protected validatePromptToolReferences(glspMcpServer: GLSPMcpServer): void {
        for (const handler of this.promptHandlers) {
            const missing = handler.referencedToolNames().filter(name => !glspMcpServer.hasTool(name));
            if (missing.length > 0) {
                this.logger.warn(
                    `Prompt '${handler.name}' references unbound tool(s): ${missing.join(', ')}. ` +
                        'The prompt will still register but its text points at tools the LLM cannot invoke.'
                );
            }
        }
    }

    protected jsonRpcErrorResponse(status: number, code: number, message: string): Response {
        return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: JSON_RPC_NULL_ID }), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
