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

import { ClientSessionManager, InitializeParameters, InitializeResult, Logger, NullLogger } from '@eclipse-glsp/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as z from 'zod/v4';
import { FullMcpServerConfiguration } from '../../common/server/abstract-mcp-server-launcher';
import { DefaultGLSPMcpServer, GLSPMcpServerFactory } from '../../common/server/glsp-mcp-server';
import { McpDiagramHandlerDispatcher } from '../../common/server/mcp-diagram-handler-dispatcher';
import { DefaultMcpLogLevelRegistry, McpLogLevelRegistry } from '../../common/server/mcp-log-level-registry';
import { McpServerDefaults, McpServerOptions } from '../../common/server/mcp-options';
import { NodeMcpServerLauncher } from './node-mcp-server-launcher';
import { rawHttpRequest } from './raw-http.spec';

class StubDispatcher implements McpDiagramHandlerDispatcher {
    harvest(): void {
        /* no-op */
    }
    reset(): void {
        /* no-op */
    }
    hasDiagramTools(): boolean {
        return false;
    }
    hasDiagramResources(): boolean {
        return false;
    }
    hasDiagramPrompts(): boolean {
        return false;
    }
    registerAll(): void {
        /* no-op */
    }
}

class StubClientSessionManager {
    addListener(): boolean {
        return true;
    }
    removeListener(): boolean {
        return true;
    }
    getSessions(): unknown[] {
        return [];
    }
    getSession(): unknown {
        return undefined;
    }
    getSessionsByType(): unknown[] {
        return [];
    }
}

/**
 * Test subclass that registers a single `echo` tool on every fresh GLSP MCP server. We use this
 * to drive a real MCP SDK client through a full handshake without depending on the workflow
 * server's diagram handler stack.
 */
class EchoLauncher extends NodeMcpServerLauncher {
    protected override createGlspMcpServer(config: FullMcpServerConfiguration): DefaultGLSPMcpServer {
        const server = super.createGlspMcpServer(config) as DefaultGLSPMcpServer;
        server.registerTool(
            'echo',
            { description: 'Returns the supplied message verbatim.', inputSchema: { message: z.string() } },
            async ({ message }) => ({ content: [{ type: 'text', text: message }] })
        );
        return server;
    }
}

function buildLauncher(optionValues: McpServerOptions['values'] = {}): EchoLauncher {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            const opts = new McpServerOptions();
            opts.values = optionValues;
            bind(McpServerOptions).toConstantValue(opts);
            bind(McpServerDefaults).toConstantValue(optionValues);
            bind(McpDiagramHandlerDispatcher).toConstantValue(new StubDispatcher());
            bind(McpLogLevelRegistry).to(DefaultMcpLogLevelRegistry).inSingletonScope();
            bind(ClientSessionManager).toConstantValue(new StubClientSessionManager());
            const factory: GLSPMcpServerFactory = (mcpServer, options) => new DefaultGLSPMcpServer(mcpServer, options, new NullLogger());
            bind(GLSPMcpServerFactory).toConstantValue(factory);
            bind(EchoLauncher).toSelf().inSingletonScope();
        })
    );
    return container.get(EchoLauncher);
}

async function startLauncher(
    launcher: EchoLauncher,
    options: { port?: number; host?: string; route?: string; allowedHosts?: string[]; allowedOrigins?: string[] } = {}
): Promise<string> {
    const params: InitializeParameters = {
        applicationId: 'spec-app',
        clientSessionId: 'spec-session',
        protocolVersion: '1.0.0',
        args: {},
        mcpServer: {
            port: options.port ?? 0,
            route: options.route ?? '/mcp',
            name: 'spec',
            options: {}
        }
    } as unknown as InitializeParameters;
    // Inject the deploy-only fields directly on the merged options holder.
    launcher['mcpDefaults'] = {
        host: options.host ?? '127.0.0.1',
        allowedHosts: options.allowedHosts,
        allowedOrigins: options.allowedOrigins
    };
    const baseResult: InitializeResult = { protocolVersion: '1.0.0', serverActions: {} } as unknown as InitializeResult;
    const result = await launcher.initializeServer({} as never, params, baseResult);
    const url = (result as unknown as { mcpServer?: { url?: string } }).mcpServer?.url;
    if (!url) throw new Error('launcher did not announce a URL');
    return url;
}

/**
 * End-to-end smoke test: boot the launcher (which spins up the Hono-on-Node listener),
 * connect a real SDK MCP client over Streamable HTTP, and exercise a tool round-trip (`echo`).
 */
describe('NodeMcpServerLauncher (e2e — real MCP SDK client over HTTP)', () => {
    let launcher: EchoLauncher | undefined;
    let client: Client | undefined;

    async function safeClose(target: Client | undefined): Promise<void> {
        if (!target) return;
        try {
            await target.close();
        } catch {
            /* ignore — best effort */
        }
    }

    afterEach(async () => {
        await safeClose(client);
        client = undefined;
        launcher?.dispose();
        launcher = undefined;
    });

    it('round-trips tools/list and tools/call against a registered echo tool', async () => {
        launcher = buildLauncher();
        const url = await startLauncher(launcher);
        expect(url, 'launcher must announce a URL after initializeServer').to.be.a('string');

        client = new Client({ name: 'wn-058-test-client', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(url)));

        const tools = await client.listTools();
        expect(tools.tools.map(tool => tool.name)).to.include('echo');

        const result = await client.callTool({ name: 'echo', arguments: { message: 'hello GLSP' } });
        expect(result.isError).to.not.equal(true);
        expect(result.content).to.have.lengthOf(1);
        const [block] = result.content as Array<{ type: string; text?: string }>;
        expect(block.type).to.equal('text');
        expect(block.text).to.equal('hello GLSP');
    });

    it('DELETE /mcp terminates the session; subsequent POSTs with the same id return 404 (§ #5)', async () => {
        launcher = buildLauncher();
        const url = await startLauncher(launcher);

        client = new Client({ name: 'delete-smoke-test', version: '1.0.0' });
        const clientTransport = new StreamableHTTPClientTransport(new URL(url));
        await client.connect(clientTransport);
        const sessionId = clientTransport.sessionId;
        expect(sessionId, 'SDK transport should expose the minted session id after initialize').to.be.a('string');

        const port = Number(new URL(url).port);

        const deleteRes = await rawHttpRequest(port, 'DELETE', { 'mcp-session-id': sessionId! });
        expect(deleteRes.status, 'DELETE should succeed for an active session').to.be.lessThan(300);

        const followUp = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-session-id': sessionId! },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );
        expect(followUp.status).to.equal(404);
        const payload = JSON.parse(followUp.body);
        expect(payload.error.code).to.equal(-32001);
    });
});

describe('NodeMcpServerLauncher (raw HTTP wire validation)', () => {
    let launcher: EchoLauncher | undefined;

    afterEach(() => {
        launcher?.dispose();
        launcher = undefined;
    });

    async function startWith(values: McpServerOptions['values']): Promise<number> {
        launcher = buildLauncher(values);
        const url = await startLauncher(launcher, { allowedHosts: values.allowedHosts, allowedOrigins: values.allowedOrigins });
        return Number(new URL(url).port);
    }

    it('binds an HTTP listener on a resolvable loopback port', async () => {
        launcher = buildLauncher();
        const url = await startLauncher(launcher);
        expect(url).to.match(/^http:\/\/(127\.0\.0\.1|localhost):\d+\/mcp$/);
    });

    it('rejects a non-initialize POST without an Mcp-Session-Id header with 400 (§ #2)', async () => {
        const port = await startWith({});
        const res = await rawHttpRequest(port, 'POST', {}, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.code).to.equal(-32000);
        expect(payload.error.message).to.match(/No valid session ID/);
    });

    it('rejects a POST with an unknown Mcp-Session-Id with 404 (§ #3)', async () => {
        const port = await startWith({});
        const res = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-session-id': 'no-such-session' },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );
        expect(res.status).to.equal(404);
        const payload = JSON.parse(res.body);
        expect(payload.error.code).to.equal(-32001);
    });

    it('rejects a non-initialize POST whose MCP-Protocol-Version is unsupported with HTTP 400', async () => {
        const port = await startWith({});
        const res = await rawHttpRequest(
            port,
            'POST',
            { 'mcp-session-id': 'doesnt-matter', 'mcp-protocol-version': '1999-01-01' },
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        );
        expect(res.status).to.equal(400);
        const payload = JSON.parse(res.body);
        expect(payload.error.message).to.match(/Unsupported MCP-Protocol-Version/);
    });

    it('rejects requests with a Host header outside the allowlist', async () => {
        const port = await startWith({ allowedHosts: ['127.0.0.1', 'localhost'] });
        // POST init body so we go past session-id validation into the SDK transport's host check.
        const res = await rawHttpRequest(
            port,
            'POST',
            { Host: 'evil.example' },
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } }
            }
        );
        expect(res.status).to.equal(403);
    });

    it('rejects start when the requested port is already in use with an actionable error', async () => {
        const firstLauncher = buildLauncher();
        const url = await startLauncher(firstLauncher);
        const taken = Number(new URL(url).port);
        const secondLauncher = buildLauncher();
        let error: Error | undefined;
        try {
            await startLauncher(secondLauncher, { port: taken });
        } catch (err: unknown) {
            error = err as Error;
        } finally {
            firstLauncher.dispose();
            secondLauncher.dispose();
        }
        expect(error, 'expected initializeServer to reject').to.not.equal(undefined);
        expect(error!.message).to.match(/127\.0\.0\.1:\d+/);
        expect(error!.message).to.include('mcpServer.port');
        expect(error!.message).to.match(/already in use/);
    });
});
