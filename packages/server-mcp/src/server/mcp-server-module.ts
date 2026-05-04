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

import { McpServerOptions as McpServerOptionsType } from '@eclipse-glsp/protocol';
import { BindingContext } from '@eclipse-glsp/protocol/lib/di';
import {
    AbstractMultiBinding,
    applyBindingTarget,
    BindingTarget,
    GLSPModule,
    GLSPServerInitializer,
    GLSPServerListener
} from '@eclipse-glsp/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { interfaces } from 'inversify';
import { DescribeDiagramMcpPromptHandler, SuggestImprovementsMcpPromptHandler } from '../prompts';
import { ElementTypesMcpToolHandler, SessionInfoMcpToolHandler } from '../tools';
import { DefaultGLSPMcpServer, GLSPMcpServerFactory } from './glsp-mcp-server';
import { DefaultMcpDiagramHandlerDispatcher, McpDiagramHandlerDispatcher } from './mcp-diagram-handler-dispatcher';
import { DefaultMcpLogLevelRegistry, McpLogLevelRegistry } from './mcp-log-level-registry';
import { LruEventStore } from './lru-event-store';
import { McpHttpTransport } from './mcp-http-transport';
import { McpLogger } from './mcp-logger';
import { McpServerDefaults, McpServerOptions } from './mcp-options';
import { McpProgressReporter } from './mcp-progress-reporter';
import { McpPromptHandler } from './mcp-prompt-handler';
import { McpResourceHandler } from './mcp-resource-handler';
import { McpServerLauncher } from './mcp-server-launcher';
import { McpToolHandler } from './mcp-tool-handler';

/**
 * GLSP-generic default agent persona — adopters typically pass a product-specific persona to
 * the {@link DefaultMcpServerModule} constructor (e.g. workflow-server might say "You are the
 * Workflow Modeling Agent...").
 *
 * **Spec note.** This is wired to the MCP `instructions` field, which the spec describes as
 * "concise instructions". This persona is intentionally verbose (~700 chars of behavior rules)
 * — within the spec's "free-form server-supplied instructions" allowance and adopter-overridable
 * via `mcpDefaults.agentPersona`. Don't trim on autopilot if a "concise" interpretation drifts
 * back: the verbose form materially improves LLM tool-use compliance for graphical modelling.
 */
const DEFAULT_AGENT_PERSONA = `
You are the GLSP Modeling Agent. Your primary goal is to assist in the creation and modification of graphical models using the
GLSP MCP server. You have to adhere to the following principles:
- MCP-Interaction: Any modeling related activity has to occur using the MCP server.
- Real Data: The diagram model is the ground truth regarding the existing graphical model. Always query it before modifying the diagram.
- Real Creation: Consult the available element types before creating elements.
- Visual Proof: An image of the graphical model can be created, if you deem it useful for calculating or verifying layout decisions.
- Precision: All IDs and types must be exact.
- Visualization: When creating nodes, suggest sensible default positions and avoid visual overlapping.
- Careful: Under no circumstances save the model without explicit instruction. If you deem it sensible, you may ask the user for permission.
  The same goes for Undo/Redo operations.
- Layouting: If available, make use of automatic layouting when not given explicit custom layouting requirements.
- Human-friendly references: When mentioning an element in user-visible prose, prefer its label, then its element type
  (the bare ids returned by the tools are internal aliases that mean nothing to the user). Append the alias in parentheses
  so the user can correlate it with follow-up tools. Use the \`set-selection\` tool — or the \`set-view\` tool with
  \`action: "center-on-elements"\` — to point the user at the elements you reference.
`;

/**
 * Multi-binding helper for MCP handler classes. Singleton-scoped sibling of core's
 * `MultiBinding<T>` — same `binding.add(...)` / `binding.rebind(old, new)` adopter shape, but
 * core's plain `MultiBinding` binds in transient scope, while MCP handlers cache deferred
 * resolvers (selection/PNG round-trips) and need singleton scope to keep their state.
 */
export class McpHandlerMultiBinding<T> extends AbstractMultiBinding<interfaces.Newable<T>> {
    override applyBindings(context: BindingContext): void {
        this.bindings.forEach(handlerClass => {
            if (!context.isBound(handlerClass)) {
                context.bind(handlerClass).toSelf().inSingletonScope();
            }
            context.bind(this.identifier).toService(handlerClass);
        });
    }
}

/**
 * Server-scope DI module for the MCP server. Adopters subclass {@link DefaultMcpServerModule}
 * and override the `bind*` hooks to swap single-instance services or the `configure*` hooks to
 * add/replace handlers in the multi-bindings. Mirrors the `DiagramModule` pattern from core
 * (`bindGModelSerializer()`, `configureActionHandlers(binding)`, etc.).
 *
 * Adopter-provided default option values flow through the constructor — pass a
 * `Partial<McpServerOptions>` to override individual fields. The launcher then merges these
 * defaults with init-time options from the GLSP `initialize` request (init-time wins per field).
 *
 * @example
 * ```ts
 * // Drop-in: GLSP defaults.
 * launcher.configure(serverModule, new DefaultMcpServerModule());
 *
 * // Drop-in with a product-specific override.
 * launcher.configure(serverModule, new DefaultMcpServerModule({ dataMode: 'resources' }));
 *
 * // Subclass when handler customization is needed.
 * class WorkflowMcpServerModule extends DefaultMcpServerModule {
 *     constructor() { super({ agentPersona: WORKFLOW_PERSONA }); }
 *     protected override configureToolHandlers(binding) {
 *         super.configureToolHandlers(binding);
 *         binding.add(WorkflowSpecificTool);
 *     }
 * }
 * ```
 */
export abstract class AbstractMcpServerModule extends GLSPModule {
    protected bind!: interfaces.Bind;
    protected rebind!: interfaces.Rebind;

    constructor(protected readonly defaultOptions: McpServerDefaults = {}) {
        super();
    }

    protected override configure(
        bind: interfaces.Bind,
        _unbind: interfaces.Unbind,
        isBound: interfaces.IsBound,
        rebind: interfaces.Rebind
    ): void {
        this.bind = bind;
        this.rebind = rebind;
        const context = { bind, isBound };
        applyBindingTarget(context, McpServerLauncher, this.bindMcpServerLauncher()).inSingletonScope();
        // The launcher is bound under two additional service identifiers so core's existing
        // multi-bindings pick it up alongside the rest of the server's contributions/listeners.
        bind(GLSPServerInitializer).toService(McpServerLauncher);
        bind(GLSPServerListener).toService(McpServerLauncher);
        applyBindingTarget(context, McpHttpTransport, this.bindMcpHttpTransport()).inSingletonScope();
        applyBindingTarget(context, McpDiagramHandlerDispatcher, this.bindMcpDiagramHandlerDispatcher()).inSingletonScope();
        applyBindingTarget(context, McpServerOptions, this.bindMcpServerOptions()).inSingletonScope();
        applyBindingTarget(context, McpServerDefaults, this.bindMcpServerDefaults());
        applyBindingTarget(context, McpLogger, this.bindMcpLogger()).inSingletonScope();
        applyBindingTarget(context, McpLogLevelRegistry, this.bindMcpLogLevelRegistry()).inSingletonScope();
        applyBindingTarget(context, McpProgressReporter, this.bindMcpProgressReporter()).inSingletonScope();
        applyBindingTarget(context, GLSPMcpServerFactory, this.bindGLSPMcpServerFactory());
        this.configureMultiBinding(new McpHandlerMultiBinding<McpToolHandler>(McpToolHandler), binding =>
            this.configureToolHandlers(binding as McpHandlerMultiBinding<McpToolHandler>)
        );
        this.configureMultiBinding(new McpHandlerMultiBinding<McpResourceHandler>(McpResourceHandler), binding =>
            this.configureResourceHandlers(binding as McpHandlerMultiBinding<McpResourceHandler>)
        );
        this.configureMultiBinding(new McpHandlerMultiBinding<McpPromptHandler>(McpPromptHandler), binding =>
            this.configurePromptHandlers(binding as McpHandlerMultiBinding<McpPromptHandler>)
        );
    }

    /**
     * {@link McpServerLauncher} binding. Bound as a singleton AND aliased to
     * `GLSPServerInitializer` + `GLSPServerListener` (the launcher implements both).
     * Override to swap in a custom launcher impl.
     */
    protected bindMcpServerLauncher(): BindingTarget<McpServerLauncher> {
        return McpServerLauncher;
    }

    /** {@link McpHttpTransport} binding. Override to swap to a different transport implementation. */
    protected bindMcpHttpTransport(): BindingTarget<McpHttpTransport> {
        return McpHttpTransport;
    }

    /**
     * {@link McpDiagramHandlerDispatcher} binding. Owns diagram-scope handler discovery,
     * SDK registration, and per-call dispatch routing. Override (or `rebind` to a subclass)
     * to customize registration without subclassing the launcher itself.
     */
    protected bindMcpDiagramHandlerDispatcher(): BindingTarget<DefaultMcpDiagramHandlerDispatcher> {
        return DefaultMcpDiagramHandlerDispatcher;
    }

    /** {@link McpServerOptions} holder binding. Mutated at init by the launcher. */
    protected bindMcpServerOptions(): BindingTarget<McpServerOptions> {
        return McpServerOptions;
    }

    /**
     * {@link McpServerDefaults} binding — adopter-supplied default option values flow through
     * the constructor and land here as a constant. The launcher merges these defaults with
     * init-time options at server init (init-time wins per field).
     */
    protected bindMcpServerDefaults(): BindingTarget<McpServerDefaults> {
        return { constantValue: this.defaultOptions };
    }

    /**
     * {@link McpLogger} binding. Bound on the server container; per-session containers inherit
     * it, so handlers at any scope can inject it; routes through the active MCP request via
     * {@link mcpRequestContext}.
     */
    protected bindMcpLogger(): BindingTarget<McpLogger> {
        return McpLogger;
    }

    /** {@link McpProgressReporter} binding. Same scope/lifecycle story as {@link bindMcpLogger}. */
    protected bindMcpProgressReporter(): BindingTarget<McpProgressReporter> {
        return McpProgressReporter;
    }

    /**
     * {@link McpLogLevelRegistry} binding — holds per-MCP-session `logging/setLevel` thresholds
     * read by {@link McpLogger} when filtering `notifications/message`.
     */
    protected bindMcpLogLevelRegistry(): BindingTarget<McpLogLevelRegistry> {
        return DefaultMcpLogLevelRegistry;
    }

    /**
     * {@link GLSPMcpServerFactory} binding — produces a fresh {@link DefaultGLSPMcpServer} per
     * MCP-session-init call. Override to wrap the SDK `McpServer` differently (e.g. add custom
     * middleware, swap the Proxy strategy).
     */
    protected bindGLSPMcpServerFactory(): BindingTarget<GLSPMcpServerFactory> {
        return {
            dynamicValue:
                () =>
                (mcpServer: McpServer, options: McpServerOptionsType): DefaultGLSPMcpServer =>
                    new DefaultGLSPMcpServer(mcpServer, options)
        };
    }

    /**
     * Override to add or replace tool handlers. Adopters typically `super.configureToolHandlers(binding)`
     * to keep the defaults, then `binding.add(MyTool)` for additions or
     * `binding.rebind(StandardTool, MyTool)` for overrides.
     */
    protected configureToolHandlers(binding: McpHandlerMultiBinding<McpToolHandler>): void {
        binding.add(SessionInfoMcpToolHandler);
        binding.add(ElementTypesMcpToolHandler);
    }

    /** See {@link configureToolHandlers}. No server-scope resources ship by default. */
    protected configureResourceHandlers(_binding: McpHandlerMultiBinding<McpResourceHandler>): void {
        // empty by default
    }

    /**
     * See {@link configureToolHandlers}. Server-scope by default because the shipped prompts
     * (`describe-diagram`, `suggest-improvements`) are diagram-type-agnostic and resolve their
     * target session at invocation time — diagram-scope adopters add prompts via
     * {@link DefaultMcpDiagramModule.configurePromptHandlers}.
     */
    protected configurePromptHandlers(binding: McpHandlerMultiBinding<McpPromptHandler>): void {
        binding.add(DescribeDiagramMcpPromptHandler);
        binding.add(SuggestImprovementsMcpPromptHandler);
    }
}

/**
 * Default {@link AbstractMcpServerModule} entry point. Ships GLSP-default option values (see
 * {@link DEFAULT_OPTIONS}) on top of the abstract module's hook defaults. Adopter-provided
 * overrides via the constructor merge on top.
 *
 * @experimental The MCP integration is under active development. Option names, schema shapes,
 * and handler contracts MAY change in minor releases until the feature graduates from
 * experimental status.
 */
export class DefaultMcpServerModule extends AbstractMcpServerModule {
    static readonly DEFAULT_OPTIONS: McpServerDefaults = {
        host: '127.0.0.1',
        allowedHosts: ['127.0.0.1', 'localhost'],
        // `allowedOrigins` deliberately undefined: accept absent Origin (typical for desktop-IDE
        // MCP clients) and rely on Host validation to gate DNS-rebinding. Adopters whose
        // deployment is browser-fronted set this explicitly to their frontend's origin.
        dataMode: 'tools',
        agentPersona: DEFAULT_AGENT_PERSONA,
        // 10K events per session is generous for typical workloads (a few MB) and large enough
        // that disconnects within seconds recover via `Last-Event-ID` resumability.
        eventStoreLimit: LruEventStore.DEFAULT_LIMIT
    };

    constructor(overrides: McpServerDefaults = {}) {
        super({ ...DefaultMcpServerModule.DEFAULT_OPTIONS, ...overrides });
    }
}
