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

import { Disposable } from '@eclipse-glsp/server';
import { AbstractMcpServerLauncher } from '../../common/server/abstract-mcp-server-launcher';
import { McpServerDefaults } from '../../common/server/mcp-options';
import { BrowserMcpServerModule } from '../modules/browser-mcp-server-module';

export const MCP_REQUEST_MESSAGE_TYPE = 'mcp-request';
export const MCP_RESPONSE_MESSAGE_TYPE = 'mcp-response';
export const MCP_INIT_PORT_MESSAGE_TYPE = 'mcp-init-port';

export interface McpRequestMessage {
    type: typeof MCP_REQUEST_MESSAGE_TYPE;
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
}

export interface McpResponseMessage {
    type: typeof MCP_RESPONSE_MESSAGE_TYPE;
    id: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    /** Transferred across `postMessage` so streaming (SSE) bodies don't get buffered. */
    body: ReadableStream<Uint8Array> | null;
}

/** Carries the SW↔Worker `MessagePort` transfer that wires MCP traffic over a dedicated channel. */
export interface McpInitPortMessage {
    type: typeof MCP_INIT_PORT_MESSAGE_TYPE;
}

export function isMcpRequestMessage(value: unknown): value is McpRequestMessage {
    return Object(value) === value && (value as { type?: unknown }).type === MCP_REQUEST_MESSAGE_TYPE;
}

export function isMcpInitPortMessage(value: unknown): value is McpInitPortMessage {
    return Object(value) === value && (value as { type?: unknown }).type === MCP_INIT_PORT_MESSAGE_TYPE;
}

/** Minimal Worker scope contract — defined locally so the package compiles without the `webworker` lib. */
export interface McpBridgeScope {
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
    removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
    postMessage(message: unknown, transfer?: Transferable[]): void;
}

/**
 * Bridges `postMessage` traffic to an {@link AbstractMcpServerLauncher} for browser / Web Worker
 * adopters that proxy MCP requests via Service-Worker → Web-Worker plumbing.
 * See `ARCHITECTURE.md` (Portable handler) for the message protocol and queueing semantics.
 */
export class McpWorkerBridge implements Disposable {
    protected resolveLauncher!: (launcher: AbstractMcpServerLauncher) => void;
    protected readonly launcherReady: Promise<AbstractMcpServerLauncher>;
    protected readonly listener = (event: MessageEvent): void => this.onMessage(event);
    /** Serialise dispatches — `BrowserMcpRequestContext` is a single-slot store, not concurrency-safe. */
    protected dispatchChain: Promise<void> = Promise.resolve();

    constructor(protected readonly scope: McpBridgeScope = self as unknown as McpBridgeScope) {
        this.launcherReady = new Promise<AbstractMcpServerLauncher>(resolve => {
            this.resolveLauncher = resolve;
        });
        this.scope.addEventListener('message', this.listener);
    }

    dispose(): void {
        this.scope.removeEventListener('message', this.listener);
    }

    /** Returns a {@link BrowserMcpServerModule} that registers its launcher with this bridge on DI activation. */
    createServerModule(overrides?: McpServerDefaults): BrowserMcpServerModule {
        const bridge = this;
        class BridgedBrowserMcpServerModule extends BrowserMcpServerModule {
            protected override onMcpServerLauncherActivated(launcher: AbstractMcpServerLauncher): void {
                bridge.bindLauncher(launcher);
            }
        }
        return new BridgedBrowserMcpServerModule(overrides);
    }

    /** First call binds; subsequent calls are no-ops. */
    bindLauncher(launcher: AbstractMcpServerLauncher): void {
        this.resolveLauncher(launcher);
    }

    protected onMessage(event: MessageEvent): void {
        const data: unknown = event.data;
        if (isMcpRequestMessage(data)) {
            this.enqueueDispatch(data, event.ports[0]);
            return;
        }
        if (isMcpInitPortMessage(data)) {
            const port = event.ports[0];
            if (!port) {
                return;
            }
            port.onmessage = portEvent => {
                const portData: unknown = portEvent.data;
                if (isMcpRequestMessage(portData)) {
                    this.enqueueDispatch(portData, port);
                }
            };
            port.start();
        }
    }

    protected enqueueDispatch(request: McpRequestMessage, port: MessagePort | undefined): void {
        this.dispatchChain = this.dispatchChain
            .then(() => this.dispatch(request, port))
            .catch(err => console.error('MCP worker bridge failed:', err));
    }

    protected async dispatch(request: McpRequestMessage, port: MessagePort | undefined): Promise<void> {
        try {
            const launcher = await this.launcherReady;
            const init: RequestInit = { method: request.method, headers: request.headers };
            if (typeof request.body === 'string') {
                init.body = request.body;
            }
            const response = await launcher.handleRequest(new Request(request.url, init));
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
            this.reply(port, {
                type: MCP_RESPONSE_MESSAGE_TYPE,
                id: request.id,
                status: response.status,
                statusText: response.statusText,
                headers,
                body: response.body
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.reply(port, {
                type: MCP_RESPONSE_MESSAGE_TYPE,
                id: request.id,
                status: 500,
                statusText: 'Internal Server Error',
                headers: { 'content-type': 'text/plain' },
                body: new Response(`MCP worker bridge error: ${message}`).body
            });
        }
    }

    protected reply(port: MessagePort | undefined, message: McpResponseMessage): void {
        const transfer = message.body ? [message.body] : [];
        if (port) {
            port.postMessage(message, transfer);
        } else {
            this.scope.postMessage(message, transfer);
        }
    }
}
