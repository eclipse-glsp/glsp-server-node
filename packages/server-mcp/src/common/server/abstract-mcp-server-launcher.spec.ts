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

import {
    ClientSessionManager,
    InitializeParameters,
    InitializeResult,
    Logger,
    NullLogger,
    McpInitializeResult
} from '@eclipse-glsp/server';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import * as z from 'zod/v4';
import { AbstractMcpServerLauncher, FullMcpServerConfiguration, TransportEndpoint } from './abstract-mcp-server-launcher';
import { DefaultGLSPMcpServer, GLSPMcpServerFactory } from './glsp-mcp-server';
import { McpDiagramHandlerDispatcher } from './mcp-diagram-handler-dispatcher';
import { DefaultMcpLogLevelRegistry, McpLogLevelRegistry } from './mcp-log-level-registry';
import { McpServerDefaults, McpServerOptions } from './mcp-options';

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
    disposeClientSession(): void {
        /* no-op */
    }
    addClientSession(): boolean {
        return true;
    }
}

interface RegisteredAuthCapture {
    authInfo?: AuthInfo;
    invoked: boolean;
}

/**
 * Test subclass: `bindTransport` is a no-op so the test drives `handleRequest` directly against
 * synthetic `Request` objects, asserting the routed `Response`.
 */
class TestNodeMcpServerLauncher extends AbstractMcpServerLauncher {
    readonly authCapture: RegisteredAuthCapture = { invoked: false };

    protected async bindTransport(_config: FullMcpServerConfiguration): Promise<TransportEndpoint> {
        return {};
    }

    /**
     * Register an `echo` tool on each new GLSP MCP server so we can drive a tool/list + tools/call
     * round-trip and capture the `extra.authInfo` argument forwarded by the SDK.
     */
    protected override createGlspMcpServer(config: FullMcpServerConfiguration): DefaultGLSPMcpServer {
        const server = super.createGlspMcpServer(config) as DefaultGLSPMcpServer;
        const capture = this.authCapture;
        server.registerTool(
            'echo',
            { description: 'Echoes back the supplied message.', inputSchema: { message: z.string() } },
            async ({ message }, extra) => {
                capture.invoked = true;
                capture.authInfo = extra?.authInfo;
                return { content: [{ type: 'text', text: message }] };
            }
        );
        return server;
    }
}

function buildLauncher(): TestNodeMcpServerLauncher {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(McpServerOptions).toSelf().inSingletonScope();
            bind(McpServerDefaults).toConstantValue({});
            bind(McpDiagramHandlerDispatcher).toConstantValue(new StubDispatcher());
            bind(McpLogLevelRegistry).to(DefaultMcpLogLevelRegistry).inSingletonScope();
            bind(ClientSessionManager).toConstantValue(new StubClientSessionManager());
            const factory: GLSPMcpServerFactory = (mcpServer, options) => new DefaultGLSPMcpServer(mcpServer, options, new NullLogger());
            bind(GLSPMcpServerFactory).toConstantValue(factory);
            bind(TestNodeMcpServerLauncher).toSelf().inSingletonScope();
        })
    );
    return container.get(TestNodeMcpServerLauncher);
}

const INIT_BODY = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'spec-client', version: '0.0.1' }
    }
};

async function initLauncher(
    launcher: TestNodeMcpServerLauncher,
    overrides: Partial<{ route: string; port: number; host: string; name: string; options: Record<string, unknown> }> = {}
): Promise<InitializeResult> {
    const params: InitializeParameters = {
        applicationId: 'spec-app',
        clientSessionId: 'spec-session',
        protocolVersion: '1.0.0',
        args: {},
        mcpServer: {
            port: overrides.port ?? 0,
            host: overrides.host ?? '127.0.0.1',
            route: overrides.route ?? '/mcp',
            name: overrides.name ?? 'spec',
            options: overrides.options ?? {}
        }
    } as unknown as InitializeParameters;
    const baseResult: InitializeResult = { protocolVersion: '1.0.0', serverActions: {} } as unknown as InitializeResult;
    return launcher.initializeServer({} as never, params, baseResult);
}

/**
 * Read an SSE stream into a list of `data:` payloads. The Web-standard transport streams JSON-RPC
 * responses over `text/event-stream`; we only need to find the first complete event for assertions.
 */
async function readSseFirstData(response: Response, timeoutMs = 2000): Promise<unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response has no body');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (const block of buffer.split('\n\n')) {
            const dataLine = block.split('\n').find(line => line.startsWith('data: '));
            if (dataLine) {
                reader.cancel().catch(() => undefined);
                return JSON.parse(dataLine.slice('data: '.length));
            }
        }
    }
    reader.cancel().catch(() => undefined);
    throw new Error('Timed out waiting for SSE data event');
}

function postInit(): Request {
    return new Request('http://test/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify(INIT_BODY)
    });
}

function postJson(sessionId: string | undefined, body: unknown): Request {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
    };
    if (sessionId !== undefined) headers['mcp-session-id'] = sessionId;
    return new Request('http://test/mcp', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('AbstractMcpServerLauncher.handleRequest', () => {
    let launcher: TestNodeMcpServerLauncher;

    beforeEach(async () => {
        launcher = buildLauncher();
        await initLauncher(launcher);
    });

    afterEach(() => {
        launcher.dispose();
    });

    it('POST initialize creates a session and returns 200 with mcp-session-id header', async () => {
        const response = await launcher.handleRequest(postInit());
        expect(response.status).to.equal(200);
        expect(response.headers.get('mcp-session-id'), 'must echo a session id after initialize').to.be.a('string');
    });

    it('POST to a known session dispatches to its transport (tools/call round-trip)', async () => {
        const initResponse = await launcher.handleRequest(postInit());
        const sessionId = initResponse.headers.get('mcp-session-id')!;
        // Read+discard the init SSE response so the transport is ready for the next POST.
        await readSseFirstData(initResponse).catch(() => undefined);

        // Per MCP spec, send `notifications/initialized` after the initialize handshake.
        await launcher.handleRequest(postJson(sessionId, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));

        const callResponse = await launcher.handleRequest(
            postJson(sessionId, {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: { name: 'echo', arguments: { message: 'hello' } }
            })
        );
        expect(callResponse.status).to.equal(200);
        const payload = (await readSseFirstData(callResponse)) as { result?: { content?: Array<{ text?: string }> } };
        expect(payload.result?.content?.[0]?.text).to.equal('hello');
    });

    it('POST without session id, non-initialize body → 400 with JSON-RPC error envelope', async () => {
        const response = await launcher.handleRequest(postJson(undefined, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }));
        expect(response.status).to.equal(400);
        const payload = (await response.json()) as { jsonrpc: string; error: { code: number; message: string }; id: unknown };
        expect(payload.jsonrpc).to.equal('2.0');
        // eslint-disable-next-line no-null/no-null
        expect(payload.id).to.equal(null);
        expect(payload.error.code).to.equal(-32000);
        expect(payload.error.message).to.match(/No valid session ID/);
    });

    it('POST with unknown session id → 404 with JSON-RPC error envelope', async () => {
        const response = await launcher.handleRequest(
            postJson('not-a-real-session', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        );
        expect(response.status).to.equal(404);
        const payload = (await response.json()) as { error: { code: number } };
        expect(payload.error.code).to.equal(-32001);
    });

    it('GET with accept: text/event-stream on a known session → 200, text/event-stream', async () => {
        const initResponse = await launcher.handleRequest(postInit());
        const sessionId = initResponse.headers.get('mcp-session-id')!;
        await readSseFirstData(initResponse).catch(() => undefined);

        const getResponse = await launcher.handleRequest(
            new Request('http://test/mcp', {
                method: 'GET',
                headers: { accept: 'text/event-stream', 'mcp-session-id': sessionId }
            })
        );
        expect(getResponse.status).to.equal(200);
        expect(getResponse.headers.get('content-type')).to.match(/text\/event-stream/);
        getResponse.body?.cancel().catch(() => undefined);
    });

    it('GET on unknown session → 404', async () => {
        const response = await launcher.handleRequest(
            new Request('http://test/mcp', {
                method: 'GET',
                headers: { accept: 'text/event-stream', 'mcp-session-id': 'nope' }
            })
        );
        expect(response.status).to.equal(404);
    });

    it('DELETE on known session fires onSessionClosed; subsequent POSTs return 404', async () => {
        const closedIds: string[] = [];
        launcher.onSessionClosed(sessionId => closedIds.push(sessionId));

        const initResponse = await launcher.handleRequest(postInit());
        const sessionId = initResponse.headers.get('mcp-session-id')!;
        await readSseFirstData(initResponse).catch(() => undefined);

        const deleteResponse = await launcher.handleRequest(
            new Request('http://test/mcp', { method: 'DELETE', headers: { 'mcp-session-id': sessionId } })
        );
        expect(deleteResponse.status).to.be.lessThan(300);
        expect(closedIds).to.include(sessionId);

        const followUp = await launcher.handleRequest(postJson(sessionId, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
        expect(followUp.status).to.equal(404);
    });

    it('Non-init POST with unsupported MCP-Protocol-Version → 400 with JSON-RPC error envelope', async () => {
        const response = await launcher.handleRequest(
            new Request('http://test/mcp', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'mcp-session-id': 'anything',
                    'mcp-protocol-version': '1999-01-01'
                },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
            })
        );
        expect(response.status).to.equal(400);
        const payload = (await response.json()) as { error: { code: number; message: string } };
        expect(payload.error.code).to.equal(-32000);
        expect(payload.error.message).to.match(/Unsupported MCP-Protocol-Version/);
    });

    it('POST with no MCP-Protocol-Version header passes the version gate (falls through to session-id check)', async () => {
        // Spec: server defaults to `2025-03-26` when the header is absent. We assert by
        // sending no session id and observing the 400 "No valid session ID" — proving the
        // version gate didn't short-circuit.
        const response = await launcher.handleRequest(
            new Request('http://test/mcp', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
            })
        );
        expect(response.status).to.equal(400);
        const payload = (await response.json()) as { error: { message: string } };
        expect(payload.error.message).to.match(/No valid session ID/);
    });

    it('authInfo from handleRequest reaches the registered tool handler extra', async () => {
        const initResponse = await launcher.handleRequest(postInit());
        const sessionId = initResponse.headers.get('mcp-session-id')!;
        await readSseFirstData(initResponse).catch(() => undefined);

        await launcher.handleRequest(postJson(sessionId, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));

        const authInfo: AuthInfo = { token: 'bearer-xyz', clientId: 'spec-client', scopes: ['mcp:tools'] };
        const callResponse = await launcher.handleRequest(
            postJson(sessionId, {
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: { name: 'echo', arguments: { message: 'auth-check' } }
            }),
            { authInfo }
        );
        await readSseFirstData(callResponse).catch(() => undefined);

        expect(launcher.authCapture.invoked).to.equal(true);
        expect(launcher.authCapture.authInfo?.token).to.equal('bearer-xyz');
        expect(launcher.authCapture.authInfo?.clientId).to.equal('spec-client');
    });

    it('onSessionInitialized fires on initialize', async () => {
        const sessionIds: string[] = [];
        launcher.onSessionInitialized(session => sessionIds.push(session.sessionId));

        const response = await launcher.handleRequest(postInit());
        const sessionId = response.headers.get('mcp-session-id')!;
        expect(sessionIds).to.include(sessionId);
    });

    it('Route mismatch (POST /other when launcher route is /mcp) → 404', async () => {
        const response = await launcher.handleRequest(
            new Request('http://test/other', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
        );
        expect(response.status).to.equal(404);
    });

    it('Unsupported method (PUT /mcp) → 405 with Allow header', async () => {
        const response = await launcher.handleRequest(new Request('http://test/mcp', { method: 'PUT' }));
        expect(response.status).to.equal(405);
        expect(response.headers.get('Allow')).to.equal('POST, GET, DELETE');
    });
});

describe('AbstractMcpServerLauncher · initializeServer lifecycle', () => {
    it('Idempotent initializeServer: second call reuses existing config without re-binding', async () => {
        const launcher = buildLauncher();
        let bindCount = 0;
        const original = (launcher as unknown as { bindTransport: () => Promise<TransportEndpoint> }).bindTransport.bind(launcher);
        (launcher as unknown as { bindTransport: () => Promise<TransportEndpoint> }).bindTransport = async () => {
            bindCount += 1;
            return original();
        };

        await initLauncher(launcher);
        await initLauncher(launcher);
        expect(bindCount).to.equal(1);
        launcher.dispose();
    });

    it('dispose() closes sessions and resets state; a subsequent initializeServer boots cleanly', async () => {
        const launcher = buildLauncher();
        await initLauncher(launcher);
        const firstResponse = await launcher.handleRequest(postInit());
        expect(firstResponse.headers.get('mcp-session-id')).to.be.a('string');
        await readSseFirstData(firstResponse).catch(() => undefined);

        launcher.dispose();

        // Re-init from the same instance — proves dispose() cleared the singleton state.
        await initLauncher(launcher, { route: '/mcp', name: 'spec-2' });
        const secondResponse = await launcher.handleRequest(postInit());
        expect(secondResponse.status).to.equal(200);
        expect(secondResponse.headers.get('mcp-session-id')).to.be.a('string');
        launcher.dispose();
    });

    it('honors the custom `route` from initialize params', async () => {
        const launcher = buildLauncher();
        await initLauncher(launcher, { route: '/custom' });

        const wrongRoute = await launcher.handleRequest(postInit());
        expect(wrongRoute.status).to.equal(404);

        const correctRoute = await launcher.handleRequest(
            new Request('http://test/custom', {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
                body: JSON.stringify(INIT_BODY)
            })
        );
        expect(correctRoute.status).to.equal(200);
        launcher.dispose();
    });

    it('attaches mcpServer.url to the returned InitializeResult when bindTransport reports a URL', async () => {
        const launcher = buildLauncher();
        // Override the test subclass's `bindTransport` to report a synthetic URL.
        (launcher as unknown as { bindTransport: () => Promise<TransportEndpoint> }).bindTransport = async () => ({
            url: 'http://announced.example/mcp'
        });
        const result = await initLauncher(launcher);
        expect(McpInitializeResult.is(result)).to.equal(true);
        expect(McpInitializeResult.getServer(result)?.url).to.equal('http://announced.example/mcp');
        launcher.dispose();
    });
});
