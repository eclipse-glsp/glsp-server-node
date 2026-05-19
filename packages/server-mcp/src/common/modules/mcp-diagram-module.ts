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

import { applyBindingTarget, BindingTarget, ClientSessionInitializer, GLSPModule, InstanceMultiBinding } from '@eclipse-glsp/server';
import { interfaces } from 'inversify';
import { DiagramPngMcpResourceHandler } from '../resources/handlers/diagram-png-mcp-resource-handler';
import { DiagramSvgMcpResourceHandler } from '../resources/handlers/diagram-svg-mcp-resource-handler';
import { DefaultElementTypesProvider, ElementTypesProvider } from '../resources/services/element-types-provider';
import { MarkdownMcpModelSerializer, McpModelSerializer } from '../resources/services/mcp-model-serializer';
import { CountElementsMcpToolHandler } from '../tools/handlers/count-elements-mcp-tool-handler';
import { CreateEdgesMcpToolHandler } from '../tools/handlers/create-edges-mcp-tool-handler';
import { CreateNodesMcpToolHandler } from '../tools/handlers/create-nodes-mcp-tool-handler';
import { DeleteElementsMcpToolHandler } from '../tools/handlers/delete-elements-mcp-tool-handler';
import { DiagramModelMcpToolHandler } from '../tools/handlers/diagram-model-mcp-tool-handler';
import { GetSelectionMcpToolHandler } from '../tools/handlers/get-selection-mcp-tool-handler';
import { LayoutMcpToolHandler } from '../tools/handlers/layout-mcp-tool-handler';
import { ModifyEdgesMcpToolHandler } from '../tools/handlers/modify-edges-mcp-tool-handler';
import { ModifyNodesMcpToolHandler } from '../tools/handlers/modify-nodes-mcp-tool-handler';
import { QueryElementsMcpToolHandler } from '../tools/handlers/query-elements-mcp-tool-handler';
import { RedoMcpToolHandler } from '../tools/handlers/redo-mcp-tool-handler';
import { SaveModelMcpToolHandler } from '../tools/handlers/save-model-mcp-tool-handler';
import { SetSelectionMcpToolHandler } from '../tools/handlers/set-selection-mcp-tool-handler';
import { SetViewMcpToolHandler } from '../tools/handlers/set-view-mcp-tool-handler';
import { UndoMcpToolHandler } from '../tools/handlers/undo-mcp-tool-handler';
import { ValidateDiagramMcpToolHandler } from '../tools/handlers/validate-diagram-mcp-tool-handler';
import {
    McpDiagramPromptHandlerFactory,
    McpDiagramPromptHandlerRegistry,
    McpDiagramPromptHandlerRegistryInitializer
} from '../server/mcp-diagram-prompt-handler-registry';
import {
    McpDiagramResourceHandlerFactory,
    McpDiagramResourceHandlerRegistry,
    McpDiagramResourceHandlerRegistryInitializer
} from '../server/mcp-diagram-resource-handler-registry';
import {
    McpDiagramToolHandlerFactory,
    McpDiagramToolHandlerRegistry,
    McpDiagramToolHandlerRegistryInitializer
} from '../server/mcp-diagram-tool-handler-registry';
import { DefaultMcpIdAliasService, McpIdAliasService } from '../server/mcp-id-alias-service';
import { McpDiagramScopedInput } from '../server/mcp-input-schemas';
import { DefaultMcpLabelProvider, McpLabelProvider } from '../server/mcp-label-provider';
import { AbstractMcpDiagramPromptHandler, McpDiagramPromptHandlerConstructor } from '../server/mcp-prompt-handler';
import { AbstractMcpDiagramResourceHandler, McpDiagramResourceHandlerConstructor } from '../server/mcp-resource-handler';
import { BaseMcpDiagramToolHandler, McpDiagramToolHandlerConstructor } from '../server/mcp-tool-handler';

/**
 * Per-GLSP-client-session DI module for the MCP server. Loaded inside `configureDiagramModule`
 * so each `ClientSession.container` gets its own instance of session-scoped services.
 *
 * Binds the {@link McpIdAliasService}, the {@link McpModelSerializer}, the
 * {@link ElementTypesProvider}, and the diagram-scope handler-constructor multi-bindings
 * (`McpDiagram*HandlerConstructor`). Adopters subclass and override the `bind*` hooks to swap
 * single-instance services and the `configure*` hooks to extend the multi-binding handler sets.
 *
 * @example
 * ```ts
 * class WorkflowMcpDiagramModule extends DefaultMcpDiagramModule {
 *     // Single-instance binding: return the class.
 *     protected override bindModelSerializer(): BindingTarget<McpModelSerializer> {
 *         return WorkflowMcpModelSerializer;
 *     }
 *     // Multi-binding: extend or rebind the default set.
 *     protected override configureToolHandlers(binding) {
 *         super.configureToolHandlers(binding);
 *         binding.add(WorkflowExtraTool);
 *         binding.rebind(CreateNodesMcpToolHandler, WorkflowCreateNodesMcpToolHandler);
 *     }
 * }
 * new WorkflowServerModule().configureDiagramModule(
 *     new WorkflowDiagramModule(...),
 *     elkLayoutModule,
 *     new WorkflowMcpDiagramModule()
 * );
 * ```
 */
export abstract class AbstractMcpDiagramModule extends GLSPModule {
    protected bind!: interfaces.Bind;
    protected rebind!: interfaces.Rebind;

    protected override configure(
        bind: interfaces.Bind,
        _unbind: interfaces.Unbind,
        isBound: interfaces.IsBound,
        rebind: interfaces.Rebind
    ): void {
        this.bind = bind;
        this.rebind = rebind;
        const context = { bind, isBound };
        applyBindingTarget(context, McpIdAliasService, this.bindIdAliasService()).inSingletonScope();
        applyBindingTarget(context, McpLabelProvider, this.bindLabelProvider()).inSingletonScope();
        applyBindingTarget(context, McpModelSerializer, this.bindModelSerializer()).inSingletonScope();
        applyBindingTarget(context, ElementTypesProvider, this.bindElementTypesProvider()).inSingletonScope();
        this.configureMultiBinding(new InstanceMultiBinding<McpDiagramToolHandlerConstructor>(McpDiagramToolHandlerConstructor), binding =>
            this.configureToolHandlers(binding as InstanceMultiBinding<McpDiagramToolHandlerConstructor>)
        );
        this.configureMultiBinding(
            new InstanceMultiBinding<McpDiagramResourceHandlerConstructor>(McpDiagramResourceHandlerConstructor),
            binding => this.configureResourceHandlers(binding as InstanceMultiBinding<McpDiagramResourceHandlerConstructor>)
        );
        this.configureMultiBinding(
            new InstanceMultiBinding<McpDiagramPromptHandlerConstructor>(McpDiagramPromptHandlerConstructor),
            binding => this.configurePromptHandlers(binding as InstanceMultiBinding<McpDiagramPromptHandlerConstructor>)
        );
        this.configureHandlerRegistries();
    }

    /**
     * Bind the per-GLSP-session handler registries, factories, and {@link ClientSessionInitializer}s
     * that populate the registries at session-open. Adopters typically don't override.
     *
     * Each kind (tool / resource / prompt) follows the same shape:
     *  - `Registry` — singleton-per-session, holds instantiated handlers keyed by `name`.
     *  - `Factory` — `dynamicValue` that calls `ctx.container.resolve(constructor)`, so the
     *    handler's `@inject(...)` fields resolve against the live `ClientSession.container`.
     *  - `RegistryInitializer` — at session-open, reads the constructor multi-binding (added by
     *    adopter `configure*Handlers` overrides) and instantiates each via the factory.
     *    Picked up by Inversify alongside core's own `ClientSessionInitializer`s
     *    (`OperationHandlerRegistryInitializer` etc.).
     */
    protected configureHandlerRegistries(): void {
        this.bind(McpDiagramToolHandlerRegistry).toSelf().inSingletonScope();
        this.bind<McpDiagramToolHandlerFactory>(McpDiagramToolHandlerFactory).toDynamicValue(
            ctx => (constructor: McpDiagramToolHandlerConstructor) =>
                ctx.container.resolve<BaseMcpDiagramToolHandler<McpDiagramScopedInput>>(constructor)
        );
        this.bind(McpDiagramToolHandlerRegistryInitializer).toSelf().inSingletonScope();
        this.bind(ClientSessionInitializer).toService(McpDiagramToolHandlerRegistryInitializer);

        this.bind(McpDiagramResourceHandlerRegistry).toSelf().inSingletonScope();
        this.bind<McpDiagramResourceHandlerFactory>(McpDiagramResourceHandlerFactory).toDynamicValue(
            ctx => (constructor: McpDiagramResourceHandlerConstructor) =>
                ctx.container.resolve<AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>>(constructor)
        );
        this.bind(McpDiagramResourceHandlerRegistryInitializer).toSelf().inSingletonScope();
        this.bind(ClientSessionInitializer).toService(McpDiagramResourceHandlerRegistryInitializer);

        this.bind(McpDiagramPromptHandlerRegistry).toSelf().inSingletonScope();
        this.bind<McpDiagramPromptHandlerFactory>(McpDiagramPromptHandlerFactory).toDynamicValue(
            ctx => (constructor: McpDiagramPromptHandlerConstructor) =>
                ctx.container.resolve<AbstractMcpDiagramPromptHandler<McpDiagramScopedInput>>(constructor)
        );
        this.bind(McpDiagramPromptHandlerRegistryInitializer).toSelf().inSingletonScope();
        this.bind(ClientSessionInitializer).toService(McpDiagramPromptHandlerRegistryInitializer);
    }

    /**
     * {@link McpIdAliasService} binding. Override to swap in a custom alias strategy. Bind the
     * shipped `NullMcpIdAliasService` (passthrough) to expose raw GLSP ids on the wire — useful
     * for diagnostic readability or when token cost isn't a concern.
     */
    protected bindIdAliasService(): BindingTarget<McpIdAliasService> {
        return DefaultMcpIdAliasService;
    }

    /**
     * {@link McpLabelProvider} binding. Override to teach MCP about adopter-specific label
     * locations (e.g., labels nested in header components or compartments). One override here
     * covers every read-side echo and every write-side label-edit operation.
     */
    protected bindLabelProvider(): BindingTarget<McpLabelProvider> {
        return DefaultMcpLabelProvider;
    }

    /**
     * {@link McpModelSerializer} binding. Override to swap in a diagram-type-specific serializer
     * (e.g. one that emits JSON, or knows the adopter's element schema). Per-session scope means
     * each diagram type provides its own serializer without a server-level rebind.
     */
    protected bindModelSerializer(): BindingTarget<McpModelSerializer> {
        return MarkdownMcpModelSerializer;
    }

    /**
     * {@link ElementTypesProvider} binding. Override to ship a constant-value list of creatable
     * element types for the adopter's diagram type instead of the default impl that scrapes
     * {@link OperationHandlerRegistry} (noisy for non-trivial diagrams).
     */
    protected bindElementTypesProvider(): BindingTarget<ElementTypesProvider> {
        return DefaultElementTypesProvider;
    }

    /**
     * Override to add or replace diagram-scope tool handlers. Adopters typically
     * `super.configureToolHandlers(binding)` to keep the defaults, then `binding.add(MyTool)`
     * for additions or `binding.rebind(StandardTool, MyTool)` for overrides.
     */
    protected configureToolHandlers(binding: InstanceMultiBinding<McpDiagramToolHandlerConstructor>): void {
        binding.add(CreateNodesMcpToolHandler);
        binding.add(CreateEdgesMcpToolHandler);
        binding.add(DeleteElementsMcpToolHandler);
        binding.add(SaveModelMcpToolHandler);
        binding.add(ValidateDiagramMcpToolHandler);
        binding.add(DiagramModelMcpToolHandler);
        binding.add(QueryElementsMcpToolHandler);
        binding.add(CountElementsMcpToolHandler);
        binding.add(ModifyNodesMcpToolHandler);
        binding.add(ModifyEdgesMcpToolHandler);
        binding.add(UndoMcpToolHandler);
        binding.add(RedoMcpToolHandler);
        binding.add(GetSelectionMcpToolHandler);
        binding.add(SetSelectionMcpToolHandler);
        binding.add(SetViewMcpToolHandler);
        // Auto-skips at session-open via `canRegister()` when no `LayoutEngine` is bound.
        binding.add(LayoutMcpToolHandler);
    }

    /** See {@link configureToolHandlers}. */
    protected configureResourceHandlers(binding: InstanceMultiBinding<McpDiagramResourceHandlerConstructor>): void {
        binding.add(DiagramPngMcpResourceHandler);
        binding.add(DiagramSvgMcpResourceHandler);
    }

    /**
     * See {@link configureToolHandlers}. No diagram-scope prompts ship by default — the shipped
     * `describe-diagram` and `suggest-improvements` prompts are diagram-type-agnostic and bound
     * server-scope. Adopters add their own diagram-type-specific prompts here.
     */
    protected configurePromptHandlers(_binding: InstanceMultiBinding<McpDiagramPromptHandlerConstructor>): void {
        // empty by default
    }
}

/**
 * Default {@link AbstractMcpDiagramModule} entry point. Adopters who don't need overrides
 * use it directly: `new DefaultMcpDiagramModule()`. Adopters with customizations subclass
 * `AbstractMcpDiagramModule` (or this class) and override the `bind*` / `configure*` hooks.
 *
 * @experimental The MCP integration is under active development. Option names, schema shapes,
 * and handler contracts MAY change in minor releases until the feature graduates from
 * experimental status.
 */
export class DefaultMcpDiagramModule extends AbstractMcpDiagramModule {}
