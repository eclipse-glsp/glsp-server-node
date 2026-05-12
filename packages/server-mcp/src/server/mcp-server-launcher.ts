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

import {
    ClientSessionListener,
    ClientSessionManager,
    Disposable,
    DisposableCollection,
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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ServerCapabilities, SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable, multiInject, optional } from 'inversify';
import { version as packageVersion } from '../../package.json';
import { GLSPMcpServer, GLSPMcpServerFactory } from './glsp-mcp-server';
import { McpDiagramHandlerDispatcher } from './mcp-diagram-handler-dispatcher';
import { McpHttpTransport } from './mcp-http-transport';
import { McpLogLevelRegistry } from './mcp-log-level-registry';
import { McpServerDefaults, McpServerOptions } from './mcp-options';
import { McpPromptHandler } from './mcp-prompt-handler';
import { McpResourceHandler } from './mcp-resource-handler';
import { McpSession } from './mcp-session';
import { McpToolHandler } from './mcp-tool-handler';

/**
 * Stdout tag used to announce the started MCP server so IDE integrations can pick up the URL
 * automatically. The full line is `MCP_SERVER_READY_MSG + JSON.stringify({name, url, route})`,
 * mirroring how the GLSP server itself announces its port via `START_UP_COMPLETE_MSG`.
 */
export const MCP_SERVER_READY_MSG = '[GLSP-MCP-Server]:Ready. ';

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
 * defaults via `McpServerOptions.values.host` (whose ship default lives in
 * `DefaultMcpServerModule.DEFAULT_OPTIONS`). The init/deploy split limits blast radius:
 * MCP clients can negotiate behavioral fields like `port` over the wire, but security-sensitive
 * fields like the bind interface are settable only by the adopter at process start.
 */
export type FullMcpServerConfiguration = Required<McpServerConfiguration> & { host: string };

/**
 * Defense-in-depth filter for the init-side options payload. The static type already rules
 * out deploy-only fields (`host`, `allowedHosts`, `allowedOrigins`, `acknowledgedNoAuth`) on
 * `McpServerConfiguration.options`, but the wire payload is JSON, so a malformed or
 * malicious client could smuggle extra keys. Destructure-based pick drops anything outside
 * the allowed set so deploy-only fields are sourced *only* from adopter defaults.
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
 * Returns true iff `host` is a loopback bind: `localhost`, `::1`, or any IPv4 in
 * `127.0.0.0/8`. Any other value (`0.0.0.0`, `::`, LAN/public addresses) is non-loopback.
 * Used by {@link assertLoopbackOrAcknowledged} for the auth-footgun runtime check.
 */
export function isLoopbackHost(host: string): boolean {
    return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

/**
 * Refuse to bind on a non-loopback host unless the operator has acknowledged that traffic is
 * authenticated externally (reverse proxy, mTLS, ACL). The MCP server has no built-in auth.
 * Exported for regression tests only; not part of the public surface.
 */
export function assertLoopbackOrAcknowledged(host: string, acknowledgedNoAuth: boolean | undefined): void {
    if (isLoopbackHost(host) || acknowledgedNoAuth === true) {
        return;
    }
    throw new Error(
        `Refusing to bind MCP server to non-loopback host '${host}' without authentication. ` +
            'The MCP server has no built-in auth; binding to a non-loopback interface exposes an ' +
            'unauthenticated MCP endpoint to the network. If this is intentional (e.g., the endpoint ' +
            'is fronted by a reverse proxy, mTLS, or a network ACL that authenticates traffic), set ' +
            '`acknowledgedNoAuth: true` on the McpServerDefaults you pass to the server module.'
    );
}

/**
 * Boots the embedded MCP HTTP server when a GLSP `initialize` call carries an `mcpServer`
 * configuration. Runs in-process via the {@link GLSPServerInitializer} lifecycle — not a
 * separate process runner. Diagram-scope handler discovery and dispatch are delegated to
 * {@link McpDiagramHandlerDispatcher}.
 */
@injectable()
export class McpServerLauncher implements GLSPServerInitializer, GLSPServerListener, Disposable {
    @inject(Logger) protected logger: Logger;

    @inject(McpServerOptions) protected mcpOptions: McpServerOptions;

    @inject(McpServerDefaults) protected mcpDefaults: McpServerDefaults;

    @inject(McpHttpTransport) protected transport: McpHttpTransport;

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

    /** Per-MCP-session GLSPMcpServer registry — populated on session-init, cleared on session-close. */
    protected readonly sessionServers = new Map<string, GLSPMcpServer>();

    async initializeServer(server: GLSPServer, params: InitializeParameters, result: InitializeResult): Promise<InitializeResult> {
        const mcpServerParam = McpInitializeParameters.getServerConfig(params);
        if (!mcpServerParam) {
            return result;
        }

        // Idempotent: subsequent client sessions of the same GLSP server reuse the existing
        // MCP HTTP server. Only the first call starts it.
        if (this.serverUrl && this.serverConfig) {
            return McpInitializeResult.attachServer(result, { name: this.serverConfig.name, url: this.serverUrl });
        }

        // Port defaults to 0 (random); the resolved URL is announced via the stdout marker
        // below. `host` is intentionally NOT in the init-time schema — it comes from the
        // server module's adopter defaults (no DNS-rebinding foot-gun via the LLM path).
        const { port = 0, route = '/mcp', name = 'glsp', options = {} } = mcpServerParam;
        // Init-time options win per field, but only fields in the init allowlist —
        // `pickInitOptions` strips any wire-smuggled deploy-only keys before merge.
        const mergedOptions = { ...this.mcpDefaults, ...pickInitOptions(options) };
        this.mcpOptions.values = mergedOptions;
        const host = mergedOptions.host ?? '127.0.0.1';
        // Auth-footgun guard: refuse non-loopback bind unless the operator opted in via
        // `acknowledgedNoAuth`. Runs BEFORE the transport binds the socket so a careless
        // `host: '0.0.0.0'` doesn't get a chance to expose an unauthenticated endpoint.
        assertLoopbackOrAcknowledged(host, mergedOptions.acknowledgedNoAuth);
        const mcpServerConfig: FullMcpServerConfiguration = { port, host, route, name, options: mergedOptions };

        this.dispatcher.harvest();

        // Capture the per-init subscription disposables so a dispose-then-restart cycle
        // (transport is `inSingletonScope()`) doesn't accumulate stale listeners.
        this.toDispose.push(this.transport.onSessionInitialized(client => this.onSessionInitialized(client, mcpServerConfig)));
        this.toDispose.push(this.transport.onSessionClosed(sessionId => this.onSessionClosed(sessionId)));
        this.toDispose.push(this.transport);
        this.installResourceListChangedNotifier();

        const endpoint = await this.transport.start(mcpServerConfig);
        this.serverUrl = endpoint.url;
        this.serverConfig = mcpServerConfig;
        this.logger.info(
            `MCP server '${mcpServerConfig.name}' is ready to accept new client requests on: ${this.serverUrl ?? '(no network endpoint)'}`
        );

        // stdout ready-marker for parent processes to discover the URL. Uses `console.log`
        // (not the GLSP logger) so adopter logger config can never hide it.
        console.log(MCP_SERVER_READY_MSG + JSON.stringify({ name: mcpServerConfig.name, url: this.serverUrl, route }));
        if (endpoint.url) {
            return McpInitializeResult.attachServer(result, {
                name: mcpServerConfig.name,
                url: endpoint.url,
                headers: endpoint.headers
            });
        }
        return result;
    }

    protected onSessionInitialized(client: McpSession, config: FullMcpServerConfiguration): void {
        this.logger.info(`MCP session initialized with ID: ${client.sessionId}`);
        const glspMcpServer = this.createGlspMcpServer(config);
        this.sessionServers.set(client.sessionId, glspMcpServer);
        this.registerLogLevelHandler(glspMcpServer, client.sessionId);
        // server assumes control of the connection
        glspMcpServer.connect(client);
    }

    protected onSessionClosed(sessionId: string): void {
        const glspMcpServer = this.sessionServers.get(sessionId);
        if (glspMcpServer) {
            this.sessionServers.delete(sessionId);
            this.logLevelRegistry.clear(sessionId);
            // The transport already closes the client end; close the SDK server end too.
            glspMcpServer.dispose();
            this.logger.info(`MCP session closed: ${sessionId}`);
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
            // `resources.listChanged: true` iff the catalog contains diagram-scope resources —
            // those aggregate across open GLSP sessions, so the visible list mutates with
            // session add/remove. Server-scope-only catalogs are static, so the flag stays
            // honest at `false` (the SDK reads it; clients refetch only when notified).
            ...(hasResources ? { resources: { listChanged: hasDiagramResources } } : {}),
            ...(hasPrompts ? { prompts: { listChanged: false } } : {})
        };
    }

    /**
     * Registers tool/resource/prompt handlers against the per-MCP-session GLSP MCP server. Two
     * sources flow into the catalog:
     *
     * 1. **Server-scope handlers**: singletons bound under `McpToolHandler` /
     *    `McpResourceHandler` / `McpPromptHandler`. Registered via their `register*(server)`
     *    methods — they're already-instantiated objects that close over their own state.
     *
     * 2. **Diagram-scope handlers**: registered by {@link McpDiagramHandlerDispatcher}, which
     *    walks the catalogs harvested at server start and dispatches each registered SDK
     *    callback by `params.sessionId` → per-GLSP-session container → registry lookup.
     */
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
     * Warn when a server-scope prompt's {@link AbstractMcpPromptHandler.referencedToolNames}
     * contains a name not registered on this MCP session — catches adopters who unbind a tool
     * a shipped prompt references via `${OtherHandler.NAME}`.
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

    serverShutDown(server: GLSPServer): void {
        this.dispose();
    }

    dispose(): void {
        this.sessionServers.forEach(glspMcpServer => glspMcpServer.dispose());
        this.sessionServers.clear();
        this.toDispose.dispose();
        this.toDispose.clear();
        this.serverUrl = undefined;
        this.serverConfig = undefined;
        this.dispatcher.reset();
    }
}
