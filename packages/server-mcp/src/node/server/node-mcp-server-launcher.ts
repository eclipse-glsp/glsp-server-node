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

import { Disposable } from '@eclipse-glsp/server';
import { serve } from '@hono/node-server';
import { injectable } from 'inversify';
import * as http from 'http';
import { AddressInfo } from 'net';
import { AbstractMcpServerLauncher, FullMcpServerConfiguration, TransportEndpoint } from '../../common/server/abstract-mcp-server-launcher';

// Re-export the subclass-extension types that adopters need when subclassing the launcher.
export { FullMcpServerConfiguration, TransportEndpoint } from '../../common/server/abstract-mcp-server-launcher';

/**
 * Stdout tag used to announce the started MCP server so IDE integrations can pick up the URL
 * automatically. The full line is `MCP_SERVER_READY_MSG + JSON.stringify({name, url, route})`.
 */
export const MCP_SERVER_READY_MSG = '[GLSP-MCP-Server]:Ready. ';

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
 * configuration. Runs in-process via the {@link GLSPServerInitializer} lifecycle. The portable
 * per-session multiplexer + handler dispatch lives on {@link AbstractMcpServerLauncher}; this
 * subclass only binds the Node HTTP listener via `@hono/node-server`, runs the loopback-auth
 * guard, and announces the URL via {@link MCP_SERVER_READY_MSG}.
 */
@injectable()
export class NodeMcpServerLauncher extends AbstractMcpServerLauncher {
    protected async bindTransport(config: FullMcpServerConfiguration): Promise<TransportEndpoint> {
        // Auth-footgun guard: refuse non-loopback bind unless the operator opted in via
        // `acknowledgedNoAuth`. Runs BEFORE the listener binds so a careless `host: '0.0.0.0'`
        // doesn't get a chance to expose an unauthenticated endpoint.
        assertLoopbackOrAcknowledged(config.host, config.options.acknowledgedNoAuth);

        const handler = this.getRequestHandler();
        const server = await this.startListener(handler, config);
        // Disable the per-request timeout so long-lived SSE GET streams aren't killed during
        // chat idle periods. Node's default 5-minute `requestTimeout` (>=18.1) treats SSE as
        // a single in-progress request and tears the socket whenever no events flow for ≥5 min.
        server.requestTimeout = 0;

        const addressInfo = this.resolveAddress(server);
        const url = this.toServerUrl(addressInfo, config.route);
        this.toDispose.push(Disposable.create(() => server.close()));

        // stdout ready-marker for parent processes to discover the URL. Uses `console.log`
        // (not the GLSP logger) so adopter logger config can never hide it.
        console.log(MCP_SERVER_READY_MSG + JSON.stringify({ name: config.name, url, route: config.route }));
        return { url };
    }

    /**
     * Start the Hono-on-Node listener, returning the underlying Node `http.Server` once it is
     * listening. Translates `EADDRINUSE` into an actionable error naming the offending port
     * and the override path adopters reach for first (`mcpServer.port` in `initialize`).
     */
    protected startListener(handler: (req: Request) => Promise<Response>, config: FullMcpServerConfiguration): Promise<http.Server> {
        return new Promise((resolve, reject) => {
            const server = serve({ fetch: handler, port: config.port, hostname: config.host }) as http.Server;
            server.once('error', err => {
                const nodeErr = err as NodeJS.ErrnoException;
                if (nodeErr.code === 'EADDRINUSE') {
                    const portLabel = config.port === 0 ? 'requested address' : `${config.host}:${config.port}`;
                    reject(
                        new Error(
                            `MCP server cannot bind ${portLabel}: address already in use. ` +
                                'Pass a different `mcpServer.port` in the GLSP `initialize` call, or omit the port to get a random one.'
                        )
                    );
                    return;
                }
                reject(err);
            });
            server.once('listening', () => resolve(server));
        });
    }

    protected resolveAddress(server: http.Server): AddressInfo {
        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error(`MCP server unexpectedly bound to ${String(address)} — expected an AddressInfo.`);
        }
        return address;
    }

    protected toServerUrl({ address, family, port }: AddressInfo, route: string, protocol = 'http'): string {
        const host = address === '::' || address === '0.0.0.0' ? 'localhost' : family === 'IPv6' ? `[${address}]` : address;
        return `${protocol}://${host}:${port}${route}`;
    }
}
