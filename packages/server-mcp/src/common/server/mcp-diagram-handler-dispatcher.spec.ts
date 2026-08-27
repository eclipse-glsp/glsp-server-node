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
import { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { Container, ContainerModule, inject, injectable, optional } from 'inversify';
import { describe, expect, it } from 'vitest';
import { GLSPMcpServer } from './glsp-mcp-server';
import { DefaultMcpDiagramHandlerDispatcher, DiagramTypeCatalog } from './mcp-diagram-handler-dispatcher';
import { McpDiagramToolHandlerConstructor } from './mcp-tool-handler';

/**
 * Tests the SDK-callback dispatch error path covered by `runWithToolErrorEnvelope`. The
 * concern is that pre-handler routing errors (missing/unknown sessionId, unknown handler name)
 * that the launcher's tool path `throw McpToolError` are converted into `{ isError: true }` tool
 * results by the wrap, instead of bubbling up as JSON-RPC `-32603 Internal error`.
 *
 * The prompt path is intentionally NOT wrapped — prompt errors propagate as JSON-RPC errors per
 * MCP spec semantics. This test pins that asymmetry too.
 */

type ToolCallback = (params: unknown, extra: unknown) => Promise<CallToolResult>;
type PromptCallback = (args: unknown, extra: unknown) => Promise<unknown>;
type StaticResourceCallback = (uri: URL, extra: unknown) => Promise<ReadResourceResult>;

class CapturingMcpServer {
    readonly tools = new Map<string, ToolCallback>();
    readonly prompts = new Map<string, PromptCallback>();
    readonly staticResources = new Map<string, StaticResourceCallback>();

    registerTool(name: string, _config: unknown, callback: ToolCallback): unknown {
        this.tools.set(name, callback);
        return undefined;
    }

    registerPrompt(name: string, _config: unknown, callback: PromptCallback): unknown {
        this.prompts.set(name, callback);
        return undefined;
    }

    registerResource(name: string, uriOrTemplate: unknown, _config: unknown, callback: unknown): unknown {
        if (typeof uriOrTemplate === 'string') {
            this.staticResources.set(name, callback as StaticResourceCallback);
        }
        return undefined;
    }
}

function makeDispatcher(
    catalog: DiagramTypeCatalog,
    sessions: Array<{ id: string; container?: unknown; diagramType?: string }> = []
): DefaultMcpDiagramHandlerDispatcher {
    const dispatcher = new DefaultMcpDiagramHandlerDispatcher();
    (dispatcher as unknown as { diagramCatalogs: DiagramTypeCatalog[] }).diagramCatalogs = [catalog];
    (dispatcher as unknown as { clientSessionManager: unknown }).clientSessionManager = {
        getSessions: () => sessions,
        getSession: (id: string) => sessions.find(session => session.id === id)
    };
    return dispatcher;
}

class FakeToolHandlerCtor {
    name = 'fake-tool';
    title = 'Fake';
    description = 'A test tool';
    inputSchema = { strict: () => ({}) };
    toRegistrationConfig(): unknown {
        return { title: this.title, description: this.description, inputSchema: {} };
    }
}

class FakePromptHandlerCtor {
    name = 'fake-prompt';
    title = 'FakePrompt';
    description = 'A test prompt';
    toRegistrationConfig(): unknown {
        return { title: this.title, description: this.description };
    }
}

class FakeResourceAsToolHandlerCtor {
    name = 'fake-resource';
    title = 'FakeResource';
    description = 'A test resource exposed as tool';
    mimeType = 'text/plain';
    uri = 'glsp://static/fake';
    toolAlternativeInputSchema = { strict: () => ({}) };
    toolAlternativeOutputSchema = undefined;
    toAnnotations(): undefined {
        return undefined;
    }
}

class FakeStaticResourceHandlerCtor {
    name = 'fake-static-resource';
    title = 'FakeStatic';
    description = 'A test static-URI resource';
    mimeType = 'text/plain';
    uri = 'glsp://static/fake';
    toAnnotations(): undefined {
        return undefined;
    }
}

/** Stands in for a statically bound, optional dependency such as `LayoutEngine`. */
const OptionalDependency = Symbol('OptionalDependency');

@injectable()
class GatedToolHandler {
    @inject(OptionalDependency) @optional() protected dependency?: unknown;

    readonly name = 'gated-tool';
    readonly description = 'Only supported when the optional dependency is bound';
    readonly inputSchema = { shape: {}, strict: () => ({}) };

    isSupportedByDiagramType(): boolean {
        return this.dependency !== undefined;
    }

    toRegistrationConfig(): unknown {
        return { description: this.description, inputSchema: {} };
    }
}

/** Never bound, so resolving {@link UnresolvableToolHandler} through the container throws. */
const UnboundDependency = Symbol('UnboundDependency');

/** Declares the hook, so it is probed, but its required dependency has no binding. */
@injectable()
class UnresolvableToolHandler {
    @inject(UnboundDependency) protected dependency: unknown;

    readonly name = 'unresolvable-tool';
    readonly description = 'Declares the support hook but cannot be constructed by the container';
    readonly inputSchema = { shape: {}, strict: () => ({}) };

    isSupportedByDiagramType(): boolean {
        return false;
    }

    toRegistrationConfig(): unknown {
        return { description: this.description, inputSchema: {} };
    }
}

function harvestWith(bindDependency: boolean, constructors: unknown[] = [GatedToolHandler]): DefaultMcpDiagramHandlerDispatcher {
    const diagramModule = new ContainerModule(bind => {
        bind(McpDiagramToolHandlerConstructor).toConstantValue(constructors as McpDiagramToolHandlerConstructor[]);
        if (bindDependency) {
            bind(OptionalDependency).toConstantValue({});
        }
    });
    const dispatcher = new DefaultMcpDiagramHandlerDispatcher();
    (dispatcher as unknown as { serverContainer: Container }).serverContainer = new Container();
    (dispatcher as unknown as { diagramModules: Map<string, ContainerModule[]> }).diagramModules = new Map([['test', [diagramModule]]]);
    (dispatcher as unknown as { logger: Logger }).logger = new NullLogger();
    dispatcher.harvest();
    return dispatcher;
}

describe('DefaultMcpDiagramHandlerDispatcher · diagram-type support gate', () => {
    it('registers the tool when the diagram type binds its dependency', () => {
        const captured = new CapturingMcpServer();
        harvestWith(true).registerAll(captured as unknown as GLSPMcpServer, false);

        expect(captured.tools.has('gated-tool')).toBe(true);
    });

    it('keeps the tool out of the catalog when no diagram type supports it', () => {
        const captured = new CapturingMcpServer();
        harvestWith(false).registerAll(captured as unknown as GLSPMcpServer, false);

        expect(captured.tools.has('gated-tool')).toBe(false);
    });

    it('fails open and registers a handler that declares the hook but cannot be resolved', () => {
        const captured = new CapturingMcpServer();
        harvestWith(false, [UnresolvableToolHandler]).registerAll(captured as unknown as GLSPMcpServer, false);

        // `isSupportedByDiagramType` returns false, so it survives only because probing threw.
        expect(captured.tools.has('unresolvable-tool')).toBe(true);
    });

    it('registers a duck-typed handler without the hook, without resolving it', () => {
        const captured = new CapturingMcpServer();
        harvestWith(false, [FakeToolHandlerCtor]).registerAll(captured as unknown as GLSPMcpServer, false);

        expect(captured.tools.has('fake-tool')).toBe(true);
    });
});

describe('DefaultMcpDiagramHandlerDispatcher · SDK-callback dispatch error envelope', () => {
    it('tool callback returns isError envelope when sessionId is missing', async () => {
        const dispatcher = makeDispatcher({
            diagramType: 'test',
            toolConstructors: [FakeToolHandlerCtor as unknown as DiagramTypeCatalog['toolConstructors'][number]],
            resourceConstructors: [],
            promptConstructors: []
        });
        const captured = new CapturingMcpServer();
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, false);

        const result = await captured.tools.get('fake-tool')!({}, {});
        expect(result.isError).toBe(true);
        expect((result.content as Array<{ text: string }>)[0].text).toMatch(/sessionId/);
    });

    it('tool callback returns isError envelope when sessionId is unknown', async () => {
        const dispatcher = makeDispatcher(
            {
                diagramType: 'test',
                toolConstructors: [FakeToolHandlerCtor as unknown as DiagramTypeCatalog['toolConstructors'][number]],
                resourceConstructors: [],
                promptConstructors: []
            },
            [] // no open sessions
        );
        const captured = new CapturingMcpServer();
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, false);

        const result = await captured.tools.get('fake-tool')!({ sessionId: 'unknown-glsp-id' }, {});
        expect(result.isError).toBe(true);
        expect((result.content as Array<{ text: string }>)[0].text).toMatch(/Session not found/);
    });

    it('tool callback returns isError envelope when registered handler is absent for the session', async () => {
        const sessionContainer = {
            get: () => ({
                get: () => undefined // registry returns no handler
            })
        };
        const dispatcher = makeDispatcher(
            {
                diagramType: 'test',
                toolConstructors: [FakeToolHandlerCtor as unknown as DiagramTypeCatalog['toolConstructors'][number]],
                resourceConstructors: [],
                promptConstructors: []
            },
            [{ id: 'session-1', container: sessionContainer, diagramType: 'test' }]
        );
        const captured = new CapturingMcpServer();
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, false);

        const result = await captured.tools.get('fake-tool')!({ sessionId: 'session-1' }, {});
        expect(result.isError).toBe(true);
        expect((result.content as Array<{ text: string }>)[0].text).toMatch(/No tool handler/);
    });

    it('resource-as-tool callback returns isError envelope when sessionId is missing', async () => {
        const dispatcher = makeDispatcher({
            diagramType: 'test',
            toolConstructors: [],
            resourceConstructors: [FakeResourceAsToolHandlerCtor as unknown as DiagramTypeCatalog['resourceConstructors'][number]],
            promptConstructors: []
        });
        const captured = new CapturingMcpServer();
        // dataMode='tools' (resourcesAsResources=false) → resource registers as tool fallback.
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, false);

        const result = await captured.tools.get('fake-resource')!({}, {});
        expect(result.isError).toBe(true);
        expect((result.content as Array<{ text: string }>)[0].text).toMatch(/sessionId/);
    });

    it('static-URI resource read throws McpToolError when no GLSP session is open', async () => {
        const dispatcher = makeDispatcher(
            {
                diagramType: 'test',
                toolConstructors: [],
                resourceConstructors: [FakeStaticResourceHandlerCtor as unknown as DiagramTypeCatalog['resourceConstructors'][number]],
                promptConstructors: []
            },
            [] // no open sessions
        );
        const captured = new CapturingMcpServer();
        // dataMode='resources' (resourcesAsResources=true) → resource registers as URI-addressable resource.
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, true);

        let rejection: unknown;
        try {
            await captured.staticResources.get('fake-static-resource')!(new URL('glsp://static/fake'), {});
        } catch (err: unknown) {
            rejection = err;
        }
        expect(rejection).toBeDefined();
        expect((rejection as Error).message).toMatch(/No open GLSP session/);
    });

    it('prompt callback rejects with McpToolError when sessionId is missing (no envelope wrap — by design)', async () => {
        const dispatcher = makeDispatcher({
            diagramType: 'test',
            toolConstructors: [],
            resourceConstructors: [],
            promptConstructors: [FakePromptHandlerCtor as unknown as DiagramTypeCatalog['promptConstructors'][number]]
        });
        const captured = new CapturingMcpServer();
        dispatcher.registerAll(captured as unknown as GLSPMcpServer, false);

        let rejection: unknown;
        try {
            await captured.prompts.get('fake-prompt')!({}, {});
        } catch (err: unknown) {
            rejection = err;
        }
        expect(rejection).toBeDefined();
        expect((rejection as Error).message).toMatch(/sessionId/);
    });
});
