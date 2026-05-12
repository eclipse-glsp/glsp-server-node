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

import { Logger, NullLogger } from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { McpHttpTransport } from './mcp-http-transport';
import { McpServerOptions } from './mcp-options';
import { rawHttpRequest } from './raw-http.spec';

/**
 * Builds a transport instance with a configurable `McpServerOptions` binding so tests can
 * exercise the SDK-level host allowlist (forwarded via `createMcpExpressApp`) and our own
 * Origin allowlist (installed in `configureExpressApp`).
 */
function buildTransport(optionValues: McpServerOptions['values'] = {}): McpHttpTransport {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            const opts = new McpServerOptions();
            opts.values = optionValues;
            bind(McpServerOptions).toConstantValue(opts);
            bind(McpHttpTransport).toSelf().inSingletonScope();
        })
    );
    return container.get<McpHttpTransport>(McpHttpTransport);
}

describe('McpHttpTransport (startup smoke test)', () => {
    let httpServer: McpHttpTransport | undefined;

    afterEach(() => {
        // Always tear down so a failing assertion does not leak the listening socket.
        httpServer?.dispose();
        httpServer = undefined;
    });

    it('binds an HTTP server on a resolvable port and 127.0.0.1 host', async () => {
        httpServer = buildTransport();

        const endpoint = await httpServer.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'test',
            options: { dataMode: 'tools' }
        });

        expect(endpoint.url).to.match(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);

        const address = await httpServer.getAddress();
        expect(address.address).to.equal('127.0.0.1');
        expect(address.port).to.be.a('number');
        expect(address.port).to.be.greaterThan(0);
    });

    it('exposes the underlying http.Server and Express app after start', async () => {
        httpServer = buildTransport();

        await httpServer.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'test',
            options: { dataMode: 'tools' }
        });

        expect(httpServer.app).to.not.be.undefined;
        expect(httpServer.server).to.not.be.undefined;
        expect(httpServer.server!.listening).to.equal(true);
    });

    it('closes the underlying http.Server on dispose()', async () => {
        const local = buildTransport();

        await local.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'test',
            options: { dataMode: 'tools' }
        });
        const underlying = local.server!;
        expect(underlying.listening).to.equal(true);

        local.dispose();

        // `Server.close()` is asynchronous — wait for the actual close event.
        await new Promise<void>(resolve => {
            if (!underlying.listening) {
                resolve();
                return;
            }
            underlying.once('close', () => resolve());
        });
        expect(underlying.listening).to.equal(false);
    });

    it('rejects start() with an actionable error when the requested port is already in use', async () => {
        // First transport: bind a random port so we know exactly which port is taken.
        const first = buildTransport();
        await first.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'first',
            options: { dataMode: 'tools' }
        });
        const taken = (await first.getAddress()).port;

        // Second transport: try to bind the same port → EADDRINUSE.
        const second = buildTransport();
        try {
            await expectStartToReject(second, taken);
        } finally {
            first.dispose();
            second.dispose();
        }
    });

    async function expectStartToReject(transport: McpHttpTransport, takenPort: number): Promise<void> {
        let error: Error | undefined;
        try {
            await transport.start({
                port: takenPort,
                host: '127.0.0.1',
                route: '/mcp',
                name: 'second',
                options: { dataMode: 'tools' }
            });
        } catch (err: unknown) {
            error = err as Error;
        }
        expect(error, 'expected start() to reject').to.not.equal(undefined);
        // The actionable hint must name the offending host:port AND point at the override path.
        expect(error!.message).to.include(`127.0.0.1:${takenPort}`);
        expect(error!.message).to.include('mcpServer.port');
        expect(error!.message).to.match(/already in use/);
    }
});

describe('McpHttpTransport (Origin/Host validation — DNS-rebinding mitigation)', () => {
    let httpServer: McpHttpTransport | undefined;

    afterEach(() => {
        httpServer?.dispose();
        httpServer = undefined;
    });

    it('rejects requests with a Host header outside the allowlist', async () => {
        httpServer = buildTransport({ allowedHosts: ['127.0.0.1', 'localhost'] });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        const port = (await httpServer.getAddress()).port;

        const res = await rawHttpRequest(port, 'POST', { Host: 'evil.example' }, {});

        expect(res.status).to.equal(403);
        expect(res.body).to.match(/Host/);
    });

    it('accepts requests whose Host header matches the allowlist', async () => {
        httpServer = buildTransport({ allowedHosts: ['127.0.0.1', 'localhost'] });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        const port = (await httpServer.getAddress()).port;

        // No `mcp-session-id` header on a non-init body → session-id gate rejects with 400
        // (not the middleware's 403). What matters here is that we got *past* the middleware.
        const res = await rawHttpRequest(port, 'POST', { Host: `127.0.0.1:${port}` }, {});

        expect(res.status).to.not.equal(403);
    });

    it('rejects requests whose Origin header is outside an explicit allowlist', async () => {
        httpServer = buildTransport({
            allowedHosts: ['127.0.0.1', 'localhost'],
            allowedOrigins: ['https://my-frontend.example']
        });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        const port = (await httpServer.getAddress()).port;

        const res = await rawHttpRequest(port, 'POST', { Host: '127.0.0.1', Origin: 'https://evil.example' }, {});

        expect(res.status).to.equal(403);
        expect(res.body).to.match(/Origin/);
    });

    it('skips Origin checks when allowedOrigins is undefined (desktop-IDE default)', async () => {
        httpServer = buildTransport({ allowedHosts: ['127.0.0.1', 'localhost'] });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        const port = (await httpServer.getAddress()).port;

        // With allowedOrigins undefined, ANY Origin (or none) is allowed past the middleware.
        const res = await rawHttpRequest(port, 'POST', { Host: '127.0.0.1', Origin: 'https://anything.example' }, {});

        expect(res.status).to.not.equal(403);
    });
});

describe('McpHttpTransport (session-id validation per MCP Streamable HTTP § Session Management)', () => {
    let httpServer: McpHttpTransport | undefined;

    afterEach(() => {
        httpServer?.dispose();
        httpServer = undefined;
    });

    async function startTransport(): Promise<number> {
        httpServer = buildTransport({ allowedHosts: ['127.0.0.1', 'localhost'] });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        return (await httpServer.getAddress()).port;
    }

    it('rejects a non-initialize POST without an Mcp-Session-Id header with 400 (§ #2)', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(port, 'POST', {}, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.jsonrpc).to.equal('2.0');
        // eslint-disable-next-line no-null/no-null -- JSON-RPC 2.0 § 5 mandates `null` for unattributable error responses.
        expect(payload.id).to.equal(null);
        expect(payload.error.code).to.equal(-32000);
        expect(payload.error.message).to.match(/No valid session ID/);
    });

    it('rejects a POST with an unknown Mcp-Session-Id with 404 (§ #3)', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-session-id': 'no-such-session' },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );

        expect(res.status).to.equal(404);
        const payload = JSON.parse(res.body);
        expect(payload.jsonrpc).to.equal('2.0');
        // eslint-disable-next-line no-null/no-null -- JSON-RPC 2.0 § 5 mandates `null` for unattributable error responses.
        expect(payload.id).to.equal(null);
        expect(payload.error.code).to.equal(-32001);
        expect(payload.error.message).to.match(/Session not found/i);
    });

    it('rejects an initialize POST that carries an unknown Mcp-Session-Id with 404 (§ #3 — must not silently mint)', async () => {
        const port = await startTransport();

        const initBody = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'test', version: '0.0.1' }
            }
        };

        const res = await rawHttpRequest(port, 'POST', { 'mcp-session-id': 'stale-session' }, initBody);

        expect(res.status).to.equal(404);
        const payload = JSON.parse(res.body);
        expect(payload.error.code).to.equal(-32001);
    });

    it('rejects a GET (SSE stream) with an unknown Mcp-Session-Id with the JSON-RPC envelope', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(port, 'GET', { 'mcp-session-id': 'no-such-session' });

        expect(res.status).to.equal(404);
        const payload = JSON.parse(res.body);
        expect(payload.error.code).to.equal(-32001);
        // eslint-disable-next-line no-null/no-null -- JSON-RPC 2.0 § 5 mandates `null` for unattributable error responses.
        expect(payload.id).to.equal(null);
    });

    it('rejects a DELETE without an Mcp-Session-Id header with the JSON-RPC envelope', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(port, 'DELETE', {});

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.code).to.equal(-32000);
        // eslint-disable-next-line no-null/no-null -- JSON-RPC 2.0 § 5 mandates `null` for unattributable error responses.
        expect(payload.id).to.equal(null);
    });

    // Happy path (initialize POST without session id ⇒ new session) is exercised end-to-end
    // by `mcp-http-transport-e2e.spec.ts` against a real SDK client; not duplicated here
    // because asserting it inline requires wiring up an `McpServer` to actually respond.
});

describe('McpHttpTransport (MCP-Protocol-Version header validation)', () => {
    let httpServer: McpHttpTransport | undefined;

    afterEach(() => {
        httpServer?.dispose();
        httpServer = undefined;
    });

    async function startTransport(): Promise<number> {
        httpServer = buildTransport({ allowedHosts: ['127.0.0.1', 'localhost'] });
        await httpServer.start({ port: 0, host: '127.0.0.1', route: '/mcp', name: 'test', options: {} });
        return (await httpServer.getAddress()).port;
    }

    it('rejects a non-initialize POST whose MCP-Protocol-Version is unsupported with HTTP 400', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-session-id': 'doesnt-matter', 'mcp-protocol-version': '1999-01-01' },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.jsonrpc).to.equal('2.0');
        // eslint-disable-next-line no-null/no-null -- JSON-RPC 2.0 § 5 mandates `null` for unattributable error responses.
        expect(payload.id).to.equal(null);
        expect(payload.error.code).to.equal(-32000);
        expect(payload.error.message).to.match(/Unsupported MCP-Protocol-Version/);
        expect(payload.error.message).to.match(/1999-01-01/);
        expect(payload.error.message).to.match(/Supported versions/);
    });

    it('rejects a GET whose MCP-Protocol-Version is unsupported with HTTP 400 (header validated before session lookup)', async () => {
        const port = await startTransport();

        const res = await rawHttpRequest(port, 'GET', { 'mcp-session-id': 'any', 'mcp-protocol-version': 'bogus' });

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.message).to.match(/Unsupported MCP-Protocol-Version/);
    });

    it('passes a non-initialize POST through when the MCP-Protocol-Version header is absent (spec defaults to 2025-03-26)', async () => {
        // Without the header, the protocol-version middleware must let the request through to
        // the next layer (which then enforces session-id rules). Asserting we hit the 400
        // session-id error — not the 400 protocol-version error — proves the middleware
        // didn't short-circuit.
        const port = await startTransport();

        const res = await rawHttpRequest(port, 'POST', {}, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.message).to.match(/No valid session ID/);
    });

    it('passes a non-initialize POST through when the MCP-Protocol-Version is one of the supported versions', async () => {
        // Header is supported → middleware passes → we hit the 400 session-id check, not the
        // 400 protocol-version check.
        const port = await startTransport();

        const res = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-protocol-version': '2025-06-18' },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );

        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.message).to.match(/No valid session ID/);
    });
});
