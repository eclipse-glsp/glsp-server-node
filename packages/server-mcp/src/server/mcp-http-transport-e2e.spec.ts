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
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as z from 'zod/v4';
import { McpHttpTransport } from './mcp-http-transport';
import { McpServerOptions } from './mcp-options';
import { rawHttpRequest } from './raw-http.spec';

function buildTransport(): McpHttpTransport {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            const opts = new McpServerOptions();
            opts.values = {};
            bind(McpServerOptions).toConstantValue(opts);
            bind(McpHttpTransport).toSelf().inSingletonScope();
        })
    );
    return container.get<McpHttpTransport>(McpHttpTransport);
}

/**
 * WN-058 — End-to-end smoke test that boots {@link McpHttpTransport},
 * connects a real SDK MCP client over Streamable HTTP, and exercises a tool
 * round-trip (`echo`). Validates that the transport implements the protocol
 * conformantly without depending on the GLSP handler stack.
 */
describe('McpHttpTransport (WN-058 e2e — real MCP SDK client over HTTP)', () => {
    let httpServer: McpHttpTransport | undefined;
    let client: Client | undefined;

    /**
     * Idempotent client close: a test that already tore the SDK client down (e.g. after a
     * spec-mandated DELETE on the same session) leaves the local `client` ref pointing at a
     * closed instance. `Client.close()` is safe to call twice on the SDK side, but we still
     * swallow any throw so afterEach is robust under partial-progress failures too.
     */
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
        httpServer?.dispose();
        httpServer = undefined;
    });

    it('round-trips tools/list and tools/call against a registered echo tool', async () => {
        httpServer = buildTransport();

        // Wire one fresh `McpServer` per accepted session, register an `echo` tool,
        // and let the server attach to the transport. Mirrors what `McpServerLauncher`
        // does; kept inline here so the test exercises only the transport path.
        httpServer.onSessionInitialized(session => {
            const mcpServer = new McpServer({ name: 'glsp-test', version: '1.0.0' }, { capabilities: {} });
            mcpServer.registerTool(
                'echo',
                { description: 'Returns the supplied message verbatim.', inputSchema: { message: z.string() } },
                async ({ message }) => ({ content: [{ type: 'text', text: message }] })
            );
            mcpServer.connect(session);
        });

        const endpoint = await httpServer.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'glsp-test',
            options: { dataMode: 'tools' }
        });
        expect(endpoint.url, 'transport must report a URL after start()').to.be.a('string');

        client = new Client({ name: 'wn-058-test-client', version: '1.0.0' });
        await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url!)));

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
        httpServer = buildTransport();
        httpServer.onSessionInitialized(session => {
            const mcpServer = new McpServer({ name: 'glsp-test', version: '1.0.0' }, { capabilities: {} });
            mcpServer.connect(session);
        });
        const endpoint = await httpServer.start({
            port: 0,
            host: '127.0.0.1',
            route: '/mcp',
            name: 'glsp-test',
            options: { dataMode: 'tools' }
        });

        client = new Client({ name: 'delete-smoke-test', version: '1.0.0' });
        const clientTransport = new StreamableHTTPClientTransport(new URL(endpoint.url!));
        await client.connect(clientTransport);
        const sessionId = clientTransport.sessionId;
        expect(sessionId, 'SDK transport should expose the minted session id after initialize').to.be.a('string');

        const { port } = await httpServer.getAddress();

        // 1. Spec § Session Management #5 — DELETE terminates the session.
        const deleteRes = await rawHttpRequest(port, 'DELETE', { 'mcp-session-id': sessionId! });
        expect(deleteRes.status, 'DELETE should succeed for an active session').to.be.lessThan(300);

        // 2. After termination, the same id MUST be rejected with 404 (§ #3) — proves the
        //    session was actually removed, not just acked.
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
