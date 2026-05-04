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

import { Disposable, McpServerOptions } from '@eclipse-glsp/server';
import {
    McpServer,
    RegisteredPrompt,
    RegisteredResource,
    RegisteredResourceTemplate,
    RegisteredTool
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { EmptyResultSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { injectable } from 'inversify';

export const GLSPMcpServer = Symbol('GLSPMcpServer');

/** Either a static resource or a templated resource registration. */
export type GLSPMcpResource = RegisteredResource | RegisteredResourceTemplate;

/**
 * Cadence for server-initiated `ping` requests on the standalone SSE GET stream. Below typical
 * client-side SSE read timeouts (e.g. undici's 5-min `bodyTimeout`) so the stream stays alive
 * across chat-idle periods.
 */
const KEEP_ALIVE_INTERVAL_MS = 30_000;

/** Per-ping timeout — short, since a ping with no SSE GET stream open will never resolve. */
const KEEP_ALIVE_PING_TIMEOUT_MS = 5_000;

/**
 * Curated, per-session view onto the underlying MCP server that GLSP
 * tool/resource handlers see during registration. The `register*`,
 * `sendLoggingMessage`, `isConnected`, and `connect` methods delegate to
 * the underlying server; the `list*` methods read from a registration log
 * maintained by {@link DefaultGLSPMcpServer}. `dispose()` closes the
 * underlying SDK server (called by `McpServerLauncher` on session-close
 * and on overall server shutdown).
 *
 * The `GLSP` prefix mirrors core's convention (`GLSPServer`,
 * `GLSPClientProxy`, `GLSPModule`) where it disambiguates from
 * external/SDK types. Here it specifically separates `GLSPMcpServer` from
 * the SDK's `McpServer`; the rest of this package uses an `Mcp` prefix
 * because there's no name collision.
 */
export interface GLSPMcpServer
    extends Pick<McpServer, 'registerPrompt' | 'registerResource' | 'registerTool' | 'sendLoggingMessage' | 'isConnected' | 'connect'>,
        Disposable {
    readonly options: McpServerOptions;
    listTools(): RegisteredTool[];
    /** True iff a tool with this exact `name` has been registered on this server instance. */
    hasTool(name: string): boolean;
    listResources(): GLSPMcpResource[];
    listPrompts(): RegisteredPrompt[];
    /**
     * Sends an MCP `ping` request and resolves with the empty result. Rejects on transport
     * timeout (e.g. when the standalone SSE GET stream is not currently open).
     */
    ping(): Promise<void>;
    /**
     * Escape hatch to the underlying SDK `McpServer` for advanced APIs not covered by the
     * stable {@link GLSPMcpServer} surface. The common operations ({@link connect},
     * {@link sendLoggingMessage}, the `register*` methods, {@link dispose}) are exposed
     * directly — reach for the raw server only when an SDK feature is not yet wrapped.
     *
     * The returned value is the SDK type, not a stable GLSP surface — its API may change
     * with `@modelcontextprotocol/sdk` upgrades.
     */
    getRawServer(): McpServer;
}

export const GLSPMcpServerFactory = Symbol('GLSPMcpServerFactory');

/**
 * Factory that produces a {@link GLSPMcpServer} per MCP client session.
 * Bound to {@link DefaultGLSPMcpServer} by default; rebind to swap the
 * implementation across all sessions.
 */
export type GLSPMcpServerFactory = (mcpServer: McpServer, options: McpServerOptions) => GLSPMcpServer;

@injectable()
export class DefaultGLSPMcpServer implements GLSPMcpServer {
    protected readonly tools = new Map<string, RegisteredTool>();
    protected readonly resources = new Map<string, GLSPMcpResource>();
    protected readonly prompts = new Map<string, RegisteredPrompt>();
    protected keepAliveTimer?: NodeJS.Timeout;

    readonly registerTool: McpServer['registerTool'];
    readonly registerResource: McpServer['registerResource'];
    readonly registerPrompt: McpServer['registerPrompt'];

    constructor(
        protected readonly mcpServer: McpServer,
        readonly options: McpServerOptions
    ) {
        // `register*` need an interception layer so the local registration log stays in
        // sync; the Proxy preserves the SDK's generic signatures (which a wrapped method
        // using `Parameters<>` would collapse, breaking adopter autocomplete on
        // `inputSchema → handler arg shape`).
        const { tools, resources, prompts } = this;
        this.registerTool = new Proxy(mcpServer.registerTool.bind(mcpServer), {
            apply(target, thisArg, args) {
                const registered = Reflect.apply(target, thisArg, args);
                if (typeof args[0] === 'string') {
                    tools.set(args[0], registered);
                }
                return registered;
            }
        });
        this.registerResource = new Proxy(mcpServer.registerResource.bind(mcpServer), {
            apply(target, thisArg, args) {
                const registered = Reflect.apply(target, thisArg, args);
                if (typeof args[0] === 'string') {
                    resources.set(args[0], registered);
                }
                return registered;
            }
        });
        this.registerPrompt = new Proxy(mcpServer.registerPrompt.bind(mcpServer), {
            apply(target, thisArg, args) {
                const registered = Reflect.apply(target, thisArg, args);
                if (typeof args[0] === 'string') {
                    prompts.set(args[0], registered);
                }
                return registered;
            }
        });
    }

    sendLoggingMessage(...args: Parameters<McpServer['sendLoggingMessage']>): ReturnType<McpServer['sendLoggingMessage']> {
        return this.mcpServer.sendLoggingMessage(...args);
    }

    async connect(...args: Parameters<McpServer['connect']>): ReturnType<McpServer['connect']> {
        await this.mcpServer.connect(...args);
        // Suppress the expected `RequestTimeout` when no SSE GET stream is open; surface other
        // failures via debug. `unref` so a forgotten timer can't pin the process.
        this.keepAliveTimer = setInterval(
            () =>
                this.ping().catch(err => {
                    if (!(err instanceof McpError) || err.code !== ErrorCode.RequestTimeout) {
                        console.debug('MCP keep-alive ping failed:', err);
                    }
                }),
            KEEP_ALIVE_INTERVAL_MS
        );
        this.keepAliveTimer.unref();
    }

    isConnected(): boolean {
        return this.mcpServer.isConnected();
    }

    async ping(): Promise<void> {
        // Bypass `Server.ping()` to pass a per-request timeout; SDK's no-arg wrapper uses the
        // 60s default, which leaves keep-alive pings dangling for a full minute when no SSE GET
        // stream is open.
        await this.mcpServer.server.request({ method: 'ping' }, EmptyResultSchema, { timeout: KEEP_ALIVE_PING_TIMEOUT_MS });
    }

    listTools(): RegisteredTool[] {
        return [...this.tools.values()];
    }

    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    listResources(): GLSPMcpResource[] {
        return [...this.resources.values()];
    }

    listPrompts(): RegisteredPrompt[] {
        return [...this.prompts.values()];
    }

    getRawServer(): McpServer {
        return this.mcpServer;
    }

    dispose(): void {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = undefined;
        }
        this.mcpServer.close();
    }
}
