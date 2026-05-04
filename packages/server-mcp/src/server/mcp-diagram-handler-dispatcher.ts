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
    DiagramModules,
    InjectionContainer,
    Logger,
    TEMPORARY_CLIENT_ID,
    createClientSessionModule
} from '@eclipse-glsp/server';
import { CompleteResourceTemplateCallback, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { CallToolResult, GetPromptResult, ListResourcesResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import { GLSPMcpServer } from './glsp-mcp-server';
import { McpDiagramPromptHandlerRegistry } from './mcp-diagram-prompt-handler-registry';
import { McpDiagramResourceHandlerRegistry } from './mcp-diagram-resource-handler-registry';
import { McpDiagramToolHandlerRegistry } from './mcp-diagram-tool-handler-registry';
import { McpMissingParamError, McpSessionNotFoundError, McpToolError, runWithToolErrorEnvelope } from './mcp-handler-shared';
import { McpDiagramScopedInput } from './mcp-input-schemas';
import { AbstractMcpDiagramPromptHandler, McpDiagramPromptHandlerConstructor } from './mcp-prompt-handler';
import { mcpRequestContext } from './mcp-request-context';
import { AbstractMcpDiagramResourceHandler, McpDiagramResourceHandlerConstructor, toParams } from './mcp-resource-handler';
import { BaseMcpDiagramToolHandler, McpDiagramToolHandlerConstructor } from './mcp-tool-handler';

/**
 * Per-diagram-type catalog of constructor lists, harvested at MCP-server start by loading each
 * diagram type's modules onto a temporary child container — same pattern as
 * `DefaultGlobalActionProvider` (`packages/server/src/common/actions/global-action-provider.ts:36-48`).
 * The constructors stay across MCP-session inits; the temporary container lives just long enough
 * for `getAll(...)` to read the `InstanceMultiBinding` constant value.
 */
export interface DiagramTypeCatalog {
    readonly diagramType: string;
    readonly toolConstructors: McpDiagramToolHandlerConstructor[];
    readonly resourceConstructors: McpDiagramResourceHandlerConstructor[];
    readonly promptConstructors: McpDiagramPromptHandlerConstructor[];
}

export const McpDiagramHandlerDispatcher = Symbol('McpDiagramHandlerDispatcher');

/**
 * Owns diagram-scope handler discovery, SDK registration, and per-MCP-call dispatch routing.
 * Extracted from {@link McpServerLauncher} so adopters can `rebind(McpDiagramHandlerDispatcher)`
 * to a subclass to customize registration without subclassing the entire launcher lifecycle.
 *
 * Responsibilities:
 * - Harvest per-diagram-type constructor catalogs from the diagram modules ({@link harvest}).
 * - Register one SDK tool/resource/prompt per metadata `name` against a per-MCP-session
 *   {@link GLSPMcpServer}, deduping across diagram types ({@link registerAll}).
 * - Dispatch each registered SDK callback to the per-GLSP-session handler instance, resolved
 *   from the GLSP session container by the {@link McpDiagramScopedInput.sessionId} input.
 */
@injectable()
export class DefaultMcpDiagramHandlerDispatcher {
    @inject(InjectionContainer) protected serverContainer: Container;
    @inject(DiagramModules) protected diagramModules: Map<string, ContainerModule[]>;
    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;
    @inject(Logger) protected logger: Logger;

    protected diagramCatalogs: DiagramTypeCatalog[] = [];

    /**
     * Builds {@link diagramCatalogs} once per dispatcher lifetime by loading each diagram type's
     * modules onto a temporary child container and reading out the constructor lists. Pure
     * metadata — no instances are created here.
     *
     * Loaded with the synthetic {@link TEMPORARY_CLIENT_ID} so session-scoped `@inject`
     * dependencies resolve. Diagram modules' `configure()` therefore must not have side effects
     * keyed on `ClientId`. Catalogs are harvested once and never re-read; call {@link reset} to
     * invalidate before re-harvest.
     */
    harvest(): void {
        if (this.diagramCatalogs.length > 0) {
            return;
        }
        const catalogs: DiagramTypeCatalog[] = [];
        const placeholderSessionModule = createClientSessionModule({
            clientId: TEMPORARY_CLIENT_ID,
            glspClient: { process: () => {} },
            clientActionKinds: []
        });
        for (const [diagramType, modules] of this.diagramModules) {
            const tempContainer = this.serverContainer.createChild();
            tempContainer.load(...modules, placeholderSessionModule);
            const tools = tempContainer.isBound(McpDiagramToolHandlerConstructor)
                ? tempContainer.get<McpDiagramToolHandlerConstructor[]>(McpDiagramToolHandlerConstructor)
                : [];
            const resources = tempContainer.isBound(McpDiagramResourceHandlerConstructor)
                ? tempContainer.get<McpDiagramResourceHandlerConstructor[]>(McpDiagramResourceHandlerConstructor)
                : [];
            const prompts = tempContainer.isBound(McpDiagramPromptHandlerConstructor)
                ? tempContainer.get<McpDiagramPromptHandlerConstructor[]>(McpDiagramPromptHandlerConstructor)
                : [];
            tempContainer.unbindAll();
            catalogs.push({ diagramType, toolConstructors: tools, resourceConstructors: resources, promptConstructors: prompts });
        }
        this.diagramCatalogs = catalogs;
    }

    /** True when at least one diagram type has at least one tool handler bound. */
    hasDiagramTools(): boolean {
        return this.diagramCatalogs.some(catalog => catalog.toolConstructors.length > 0);
    }

    /** True when at least one diagram type has at least one resource handler bound. */
    hasDiagramResources(): boolean {
        return this.diagramCatalogs.some(catalog => catalog.resourceConstructors.length > 0);
    }

    /** True when at least one diagram type has at least one prompt handler bound. */
    hasDiagramPrompts(): boolean {
        return this.diagramCatalogs.some(catalog => catalog.promptConstructors.length > 0);
    }

    /**
     * Registers all diagram-scope tools/resources/prompts on the supplied per-MCP-session
     * {@link GLSPMcpServer}. Resource registration shape depends on `dataMode`: `resources`
     * registers them as URI-addressable resources; `tools` (default) registers each
     * `toolAlternativeInputSchema`-bearing resource as a tool.
     */
    registerAll(glspMcpServer: GLSPMcpServer, resourcesAsResources: boolean): void {
        this.registerDiagramScopeTools(glspMcpServer);
        this.registerDiagramScopeResources(glspMcpServer, resourcesAsResources);
        this.registerDiagramScopePrompts(glspMcpServer);
    }

    protected registerDiagramScopeTools(glspMcpServer: GLSPMcpServer): void {
        const seen = new Map<string, { description: string; inputKeys: string; diagramType: string }>();
        for (const catalog of this.diagramCatalogs) {
            for (const Constructor of catalog.toolConstructors) {
                const probe = new Constructor();
                const fingerprint = {
                    description: probe.description,
                    inputKeys: Object.keys(probe.inputSchema?.shape ?? {})
                        .sort()
                        .join(','),
                    diagramType: catalog.diagramType
                };
                const existing = seen.get(probe.name);
                if (existing) {
                    if (existing.description !== fingerprint.description || existing.inputKeys !== fingerprint.inputKeys) {
                        this.logger.warn(
                            `Diagram-scope tool '${probe.name}' is registered by multiple diagram types with diverging schemas: ` +
                                `first registered by '${existing.diagramType}', shadowed registration from '${catalog.diagramType}' ` +
                                'is silently dropped. Either align schemas (description + inputSchema.shape keys must match) or ' +
                                'pick distinct tool names.'
                        );
                    }
                    continue;
                }
                seen.set(probe.name, fingerprint);
                glspMcpServer.registerTool(probe.name, probe.toRegistrationConfig(), (params, extra) =>
                    mcpRequestContext.run(extra, () => this.dispatchDiagramTool(probe.name, params))
                );
            }
        }
    }

    protected registerDiagramScopeResources(glspMcpServer: GLSPMcpServer, resourcesAsResources: boolean): void {
        const seenNames = new Set<string>();
        for (const catalog of this.diagramCatalogs) {
            for (const Constructor of catalog.resourceConstructors) {
                const probe = new Constructor();
                if (seenNames.has(probe.name)) {
                    continue;
                }
                seenNames.add(probe.name);
                if (resourcesAsResources) {
                    this.registerOneDiagramResource(glspMcpServer, probe);
                } else if (probe.toolAlternativeInputSchema) {
                    this.registerOneDiagramResourceAsTool(glspMcpServer, probe);
                }
            }
        }
    }

    protected registerOneDiagramResource(
        glspMcpServer: GLSPMcpServer,
        probe: AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>
    ): void {
        const name = probe.name;
        const annotations = probe.toAnnotations();
        const config = {
            title: probe.title,
            description: probe.description,
            mimeType: probe.mimeType,
            ...(annotations ? { annotations } : {})
        };
        if (typeof probe.uri === 'string') {
            const uri = probe.uri;
            glspMcpServer.registerResource(name, uri, config, (_uri, extra) =>
                mcpRequestContext.run(extra, () => this.dispatchStaticDiagramRead(name, uri))
            );
        } else {
            const template = this.buildAggregatingResourceTemplate(probe.uri.template, name);
            glspMcpServer.registerResource(name, template, config, (uri, params, extra) =>
                mcpRequestContext.run(extra, () => this.dispatchTemplatedDiagramRead(name, uri, params))
            );
        }
    }

    protected registerOneDiagramResourceAsTool(
        glspMcpServer: GLSPMcpServer,
        probe: AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>
    ): void {
        const name = probe.name;
        const inputSchema = probe.toolAlternativeInputSchema!;
        // `.strict()` matches the tool-handler policy — see `BaseMcpToolHandler.toRegistrationConfig`
        // for the full rationale (LLM-typoed fields surface as JSON-RPC validation errors instead
        // of being silently stripped).
        glspMcpServer.registerTool(
            name,
            {
                title: probe.title,
                description: probe.description,
                inputSchema: inputSchema.strict(),
                outputSchema: probe.toolAlternativeOutputSchema
            },
            (params, extra) => mcpRequestContext.run(extra, () => this.dispatchDiagramResourceAsTool(name, params))
        );
    }

    protected registerDiagramScopePrompts(glspMcpServer: GLSPMcpServer): void {
        const seenNames = new Set<string>();
        for (const catalog of this.diagramCatalogs) {
            for (const Constructor of catalog.promptConstructors) {
                const probe = new Constructor();
                if (seenNames.has(probe.name)) {
                    continue;
                }
                seenNames.add(probe.name);
                // Prompt errors propagate as JSON-RPC errors per spec — no `runWithToolErrorEnvelope` wrap.
                glspMcpServer.registerPrompt(probe.name, probe.toRegistrationConfig(), (args, extra) =>
                    mcpRequestContext.run(extra, () => this.dispatchDiagramPrompt(probe.name, args))
                );
            }
        }
    }

    /**
     * Builds an SDK `ResourceTemplate` whose `list`/`complete` walk all open GLSP sessions and
     * aggregate the per-session handler results. The cross-GLSP-session-pollution guard for
     * `complete` (auto-empty for non-matching sessions) is applied at the handler base level
     * via {@link AbstractMcpDiagramResourceHandler.glspSessionScopedComplete}.
     */
    protected buildAggregatingResourceTemplate(uriTemplate: string, name: string): ResourceTemplate {
        return new ResourceTemplate(uriTemplate, {
            list: extra => mcpRequestContext.run(extra, () => this.aggregateList(name)),
            complete: this.buildAggregatedCompleters(name)
        });
    }

    protected async aggregateList(name: string): Promise<ListResourcesResult> {
        const aggregated: ListResourcesResult['resources'] = [];
        const seenUris = new Set<string>();
        for (const sessionId of this.clientSessionManager.getSessions().map(session => session.id)) {
            const handler = this.findDiagramResourceHandler(name, sessionId);
            const partial = await handler?.list?.();
            if (!partial) {
                continue;
            }
            for (const entry of partial.resources) {
                if (!seenUris.has(entry.uri)) {
                    seenUris.add(entry.uri);
                    aggregated.push(entry);
                }
            }
        }
        return { resources: aggregated };
    }

    protected buildAggregatedCompleters(name: string): Record<string, CompleteResourceTemplateCallback> {
        const variableNames = this.collectCompleterVariableNames(name);
        const completers: Record<string, CompleteResourceTemplateCallback> = {};
        for (const variable of variableNames) {
            completers[variable] = async (value, ctx) => {
                const aggregated = new Set<string>();
                for (const sessionId of this.clientSessionManager.getSessions().map(session => session.id)) {
                    const handler = this.findDiagramResourceHandler(name, sessionId);
                    if (!handler) {
                        continue;
                    }
                    const sessionScoped = handler.glspSessionScopedComplete();
                    const completer = sessionScoped[variable];
                    if (!completer) {
                        continue;
                    }
                    const partial = await completer(value, ctx);
                    partial.forEach(item => aggregated.add(item));
                }
                return [...aggregated];
            };
        }
        return completers;
    }

    /** Probe each diagram type's resource constructor for `complete()` keys to wire SDK-side. */
    protected collectCompleterVariableNames(name: string): Set<string> {
        const variables = new Set<string>();
        for (const catalog of this.diagramCatalogs) {
            for (const Constructor of catalog.resourceConstructors) {
                const probe = new Constructor();
                if (probe.name !== name) {
                    continue;
                }
                Object.keys(probe.complete?.() ?? {}).forEach(key => variables.add(key));
            }
        }
        return variables;
    }

    // ── Dispatch entry points ──────────────────────────────────────────────────

    /** SDK-validated `params` against the registered Zod schema before this callback fires. */
    protected dispatchDiagramTool(name: string, params: unknown): Promise<CallToolResult> {
        return runWithToolErrorEnvelope(async () => {
            const handler = this.requireDiagramToolHandler(name, params);
            return handler.handle(params as McpDiagramScopedInput);
        });
    }

    protected dispatchStaticDiagramRead(name: string, uri: string): Promise<ReadResourceResult> {
        // Static URI on a diagram-scope resource doesn't differentiate sessions; pick the first
        // open one and surface a clear error when none is available.
        const sessionId = this.clientSessionManager.getSessions()[0]?.id;
        if (!sessionId) {
            throw new McpToolError(`No open GLSP session can serve resource '${name}'.`);
        }
        const handler = this.requireDiagramResourceHandler(name, sessionId);
        return handler.handleRead(uri, { sessionId });
    }

    protected dispatchTemplatedDiagramRead(name: string, uri: URL, params: Variables): Promise<ReadResourceResult> {
        const flat = toParams(params);
        const handler = this.requireDiagramResourceHandler(name, flat.sessionId);
        return handler.handleRead(uri.toString(), flat as McpDiagramScopedInput);
    }

    protected dispatchDiagramResourceAsTool(name: string, params: unknown): Promise<CallToolResult> {
        return runWithToolErrorEnvelope(async () => {
            const handler = this.requireDiagramResourceHandler(name, this.extractSessionId(params));
            return handler.handleAsTool(params as McpDiagramScopedInput);
        });
    }

    protected dispatchDiagramPrompt(name: string, args: unknown): Promise<GetPromptResult> {
        const handler = this.requireDiagramPromptHandler(name, args);
        return handler.handle(args as McpDiagramScopedInput);
    }

    // ── Handler resolution ─────────────────────────────────────────────────────

    /** Reads `sessionId` from a JSON-shaped tool/resource/prompt input without committing to the full schema. */
    protected extractSessionId(params: unknown): string | undefined {
        return (params as Partial<McpDiagramScopedInput>).sessionId;
    }

    /** Resolves the per-GLSP-session tool handler for `params.sessionId`, throwing on miss. */
    protected requireDiagramToolHandler(name: string, params: unknown): BaseMcpDiagramToolHandler<McpDiagramScopedInput> {
        const session = this.requireGlspSession(this.extractSessionId(params));
        const registry = session.container.get<McpDiagramToolHandlerRegistry>(McpDiagramToolHandlerRegistry);
        const handler = registry.get(name);
        if (!handler) {
            throw new McpToolError(`No tool handler '${name}' registered for diagram type '${session.diagramType}'.`);
        }
        return handler;
    }

    /** Resolves the per-GLSP-session resource handler for `sessionId`, throwing on miss. */
    protected requireDiagramResourceHandler(
        name: string,
        sessionId: string | undefined
    ): AbstractMcpDiagramResourceHandler<McpDiagramScopedInput> {
        const session = this.requireGlspSession(sessionId);
        const registry = session.container.get<McpDiagramResourceHandlerRegistry>(McpDiagramResourceHandlerRegistry);
        const handler = registry.get(name);
        if (!handler) {
            throw new McpToolError(`No resource handler '${name}' registered for diagram type '${session.diagramType}'.`);
        }
        return handler;
    }

    /** Looks up the per-GLSP-session resource handler — returns `undefined` for an unknown id. */
    protected findDiagramResourceHandler(
        name: string,
        sessionId: string
    ): AbstractMcpDiagramResourceHandler<McpDiagramScopedInput> | undefined {
        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return undefined;
        }
        return session.container.get<McpDiagramResourceHandlerRegistry>(McpDiagramResourceHandlerRegistry).get(name);
    }

    protected requireDiagramPromptHandler(name: string, args: unknown): AbstractMcpDiagramPromptHandler<McpDiagramScopedInput> {
        const session = this.requireGlspSession(this.extractSessionId(args));
        const registry = session.container.get<McpDiagramPromptHandlerRegistry>(McpDiagramPromptHandlerRegistry);
        const handler = registry.get(name);
        if (!handler) {
            throw new McpToolError(`No prompt handler '${name}' registered for diagram type '${session.diagramType}'.`);
        }
        return handler;
    }

    protected requireGlspSession(sessionId: string | undefined): { container: Container; diagramType: string } {
        if (!sessionId) {
            throw new McpMissingParamError('sessionId');
        }
        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            throw new McpSessionNotFoundError(sessionId);
        }
        return session;
    }

    /** Disposes the catalog so a subsequent {@link harvest} call re-reads the diagram modules. */
    reset(): void {
        this.diagramCatalogs = [];
    }
}
