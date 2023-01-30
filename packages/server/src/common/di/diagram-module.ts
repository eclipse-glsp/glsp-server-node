/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
    CenterAction,
    DeleteMarkersAction,
    ExportSvgAction,
    FitToScreenAction,
    NavigateToExternalTargetAction,
    NavigateToTargetAction,
    RequestBoundsAction,
    SelectAction,
    SelectAllAction,
    ServerMessageAction,
    ServerStatusAction,
    SetBoundsAction,
    SetClipboardDataAction,
    SetContextActions,
    SetDirtyStateAction,
    SetEditModeAction,
    SetEditValidationResultAction,
    SetMarkersAction,
    SetModelAction,
    SetNavigationTargetsAction,
    SetPopupModelAction,
    SetResolvedNavigationTargetAction,
    SetTypeHintsAction,
    SetViewportAction,
    SourceModelChangedAction,
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction,
    UpdateModelAction
} from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';
import { ActionDispatcher, DefaultActionDispatcher } from '../actions/action-dispatcher';
import { ActionHandlerConstructor, ActionHandlerFactory } from '../actions/action-handler';
import { ActionHandlerRegistry, ActionHandlerRegistryInitializer } from '../actions/action-handler-registry';
import { ClientActionHandler } from '../actions/client-action-handler';
import { CommandStack, DefaultCommandStack } from '../command/command-stack';
import { UndoRedoActionHandler } from '../command/undo-redo-action-handler';
import { DiagramConfiguration } from '../diagram/diagram-configuration';
import { RequestTypeHintsActionHandler } from '../diagram/request-type-hints-action-handler';
import { CommandPaletteActionProvider } from '../features/contextactions/command-palette-action-provider';
import { ContextActionsProvider } from '../features/contextactions/context-actions-provider';
import { ContextActionsProviderRegistry } from '../features/contextactions/context-actions-provider-registry';
import { ContextMenuItemProvider } from '../features/contextactions/context-menu-item-provider';
import { RequestContextActionsHandler } from '../features/contextactions/request-context-actions-handler';
import { DefaultToolPaletteItemProvider, ToolPaletteItemProvider } from '../features/contextactions/tool-palette-item-provider';
import { ContextEditValidator } from '../features/directediting/context-edit-validator';
import {
    ContextEditValidatorRegistry,
    DefaultContextEditValidatorRegistry
} from '../features/directediting/context-edit-validator-registry';
import { LabelEditValidator } from '../features/directediting/label-edit-validator';
import { RequestEditValidationHandler } from '../features/directediting/request-edit-validation-handler';
import { ComputedBoundsActionHandler } from '../features/layout/computed-bounds-action-handler';
import { LayoutEngine } from '../features/layout/layout-engine';
import { LayoutOperationHandler } from '../features/layout/layout-operation-handler';
import { GModelFactory } from '../features/model/gmodel-factory';
import { GModelIndex } from '../features/model/gmodel-index';
import { DefaultGModelSerializer, GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelState } from '../features/model/model-state';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { RequestModelActionHandler } from '../features/model/request-model-action-handler';
import { SaveModelActionHandler } from '../features/model/save-model-action-handler';
import { SourceModelStorage } from '../features/model/source-model-storage';
import { NavigationTargetProvider } from '../features/navigation/navigation-target-provider';
import {
    DefaultNavigationTargetProviderRegistry,
    NavigationTargetProviderRegistry
} from '../features/navigation/navigation-target-provider-registry';
import { NavigationTargetResolver } from '../features/navigation/navigation-target-resolver';
import { RequestNavigationTargetsActionHandler } from '../features/navigation/request-navigation-targets-action-handler';
import { ResolveNavigationTargetsActionHandler } from '../features/navigation/resolve-navigation-targets-action-handler';
import { PopupModelFactory } from '../features/popup/popup-model-factory';
import { RequestPopupModelActionHandler } from '../features/popup/request-popup-model-action-handler';
import { ModelValidator } from '../features/validation/model-validator';
import { RequestMarkersHandler } from '../features/validation/request-markers-handler';
import { CompoundOperationHandler } from '../operations/compound-operation-handler';
import { OperationActionHandler } from '../operations/operation-action-handler';
import { OperationHandlerConstructor, OperationHandlerFactory } from '../operations/operation-handler';
import { OperationHandlerRegistry, OperationHandlerRegistryInitializer } from '../operations/operation-handler-registry';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { applyBindingTarget, applyOptionalBindingTarget, BindingTarget } from './binding-target';
import { GLSPModule } from './glsp-module';
import { InstanceMultiBinding, MultiBinding } from './multi-binding';
import {
    ClientActionKinds,
    ClientId,
    ContextActionsProviders,
    ContextEditValidators,
    DiagramType,
    NavigationTargetProviders,
    Operations
} from './service-identifiers';

/**
 * The diagram module is the central configuration artifact for configuring a client session specific injector. For each
 * session that is initialized by a {@link GLSPServer} a new client session injector is created. The diagram module
 * provides the base bindings necessary to provide diagram implementation (i.e. diagram language). In addition to the
 * diagram specific bindings, session specific bindings like the {@link ModelState} are configured
 *
 * Client session injectors are child injectors of a server injector and therefore inherit the bindings from
 * {@link ServerModule}.
 *
 * The following bindings are provided:
 * - {@link DiagramType}
 * - {@link ClientId}
 * - {@link DiagramConfiguration}
 * - {@link GModelSerializer}
 * - {@link ModelState}
 * - {@link GModelIndex}
 * - {@link SourceModelStorage}
 * - {@link GModelFactory}
 * - {@link ModelSubmissionHandler}
 * - {@link ModelValidator} as optional binding
 * - {@link LabelEditValidator} as optional binding
 * - {@link ToolPaletteItemProvider}as optional binding
 * - {@link CommandPaletteActionProvider}as optional binding
 * - {@link ContextMenuItemProvider} as optional binding
 * - {@link ContextActionsProviders} as {@link ClassMultiBinding<ContextActionsProvider>} (empty)
 * - {@link ContextActionsProviderRegistry}
 * - {@link ActionDispatcher}
 * - {@link ClientActionKinds} as {@link InstanceMultiBinding<string>}
 * - {@link ActionHandler} as {@link InstanceMultiBinding<ActionHandlerConstructor>}
 * - {@link ActionHandlerFactory}
 * - {@link ActionHandlerRegistry}
 * - {@link OperationHandler} as {@link InstanceMultiBinding<OperationHandlerConstructor>}
 * - {@link OperationHandlerFactory}
 * - {@link OperationHandlerRegistry}
 * - {@link Operations}
 * - {@link CommandStack}
 * - {@link NavigationTargetResolver} as optional binding
 *   {@link NavigationTargetProvider} as {@link ClassMultiBinding<NavigationTargetProvider>} (empty)
 * - {@link NavigationTargetProviderRegistry}
 * - {@link ContextEditValidatorRegistry}
 * - {@link ContextEditValidators} as {@link ClassMultiBinding<ContextActionsProvider>} (empty)
 * - {@link ClientSessionInitializer} as {@link ClassMultiBinding<ClientSessionInitializer>}
 * - {@link PopupModelFactory}  as optional binding
 * - {@link LayoutEngine}  as optional binding
 */

export abstract class DiagramModule extends GLSPModule {
    static readonly FALLBACK_CLIENT_ID = 'FallbackClientId';
    abstract readonly diagramType: string;

    protected configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        const context = { bind, isBound };
        // Configurations
        applyBindingTarget(context, DiagramType, this.bindDiagramType());
        applyBindingTarget(context, ClientId, this.bindClientId());
        applyBindingTarget(context, DiagramConfiguration, this.bindDiagramConfiguration()).inSingletonScope();

        // Model-related bindings
        applyBindingTarget(context, GModelSerializer, this.bindGModelSerializer()).inSingletonScope();
        applyBindingTarget(context, ModelState, this.bindModelState()).inSingletonScope();
        applyBindingTarget(context, GModelIndex, this.bindGModelIndex()).inSingletonScope();
        applyBindingTarget(context, SourceModelStorage, this.bindSourceModelStorage()).inSingletonScope();
        applyBindingTarget(context, GModelFactory, this.bindGModelFactory());
        applyBindingTarget(context, ModelSubmissionHandler, this.bindModelSubmissionHandler()).inSingletonScope();

        // Model Validation
        applyOptionalBindingTarget(context, ModelValidator, this.bindModelValidator());
        applyOptionalBindingTarget(context, LabelEditValidator, this.bindLabelEditValidator());

        // Context action providers
        applyOptionalBindingTarget(context, ToolPaletteItemProvider, this.bindToolPaletteItemProvider());
        applyOptionalBindingTarget(context, CommandPaletteActionProvider, this.bindCommandPaletteActionProvider());
        applyOptionalBindingTarget(context, ContextMenuItemProvider, this.bindContextMenuItemProvider());
        this.configureMultiBinding(new MultiBinding<ContextActionsProvider>(ContextActionsProviders), binding =>
            this.configureContextActionProviders(binding)
        );
        applyBindingTarget(context, ContextActionsProviderRegistry, this.bindContextActionsProviderRegistry()).inSingletonScope();

        // Action & operation related bindings
        applyBindingTarget(context, ActionDispatcher, this.bindActionDispatcher()).inSingletonScope();
        this.configureMultiBinding(new InstanceMultiBinding<string>(ClientActionKinds), binding => this.configureClientActions(binding));
        this.configureMultiBinding(new InstanceMultiBinding<ActionHandlerConstructor>(ActionHandlerConstructor), binding =>
            this.configureActionHandlers(binding)
        );
        applyBindingTarget(context, ActionHandlerFactory, this.bindActionHandlerFactory());
        applyBindingTarget(context, ActionHandlerRegistry, this.bindActionHandlerRegistry()).inSingletonScope();
        this.configureMultiBinding(new InstanceMultiBinding<OperationHandlerConstructor>(OperationHandlerConstructor), binding =>
            this.configureOperationHandlers(binding)
        );
        applyBindingTarget(context, OperationHandlerRegistry, this.bindOperationHandlerRegistry()).inSingletonScope();
        applyBindingTarget(context, OperationHandlerFactory, this.bindOperationHandlerFactory());
        applyBindingTarget(context, Operations, this.bindOperations()).inSingletonScope();
        applyBindingTarget(context, CommandStack, this.bindCommandStack()).inSingletonScope();

        // Navigation
        applyOptionalBindingTarget(context, NavigationTargetResolver, this.bindNavigationTargetResolver());
        this.configureMultiBinding(new MultiBinding<NavigationTargetProvider>(NavigationTargetProviders), binding =>
            this.configureNavigationTargetProviders(binding)
        );
        applyBindingTarget(context, NavigationTargetProviderRegistry, this.bindNavigationTargetProviderRegistry()).inSingletonScope();

        // Context edit
        applyBindingTarget(context, ContextEditValidatorRegistry, this.bindContextEditValidatorRegistry()).inSingletonScope();
        this.configureMultiBinding(new MultiBinding<ContextEditValidator>(ContextEditValidators), binding =>
            this.configureContextEditValidators(binding)
        );

        // Misc
        this.configureMultiBinding(new MultiBinding<ClientSessionInitializer>(ClientSessionInitializer), binding =>
            this.configureClientSessionInitializers(binding)
        );
        applyOptionalBindingTarget(context, PopupModelFactory, this.bindPopupModelFactory());
        applyOptionalBindingTarget(context, LayoutEngine, this.bindLayoutEngine?.());
    }

    configureClientSessionInitializers(binding: MultiBinding<ClientSessionInitializer>): void {
        binding.add(ActionHandlerRegistryInitializer);
        binding.add(OperationHandlerRegistryInitializer);
    }

    protected configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        binding.add(ClientActionHandler);
        binding.add(RequestModelActionHandler);
        binding.add(RequestContextActionsHandler);
        binding.add(RequestTypeHintsActionHandler);
        binding.add(OperationActionHandler);
        binding.add(RequestMarkersHandler);
        binding.add(RequestPopupModelActionHandler);
        binding.add(RequestEditValidationHandler);
        binding.add(RequestNavigationTargetsActionHandler);
        binding.add(ResolveNavigationTargetsActionHandler);
        binding.add(SaveModelActionHandler);
        binding.add(UndoRedoActionHandler);
        binding.add(ComputedBoundsActionHandler);
    }

    protected bindDiagramType(): BindingTarget<string> {
        return { constantValue: this.diagramType };
    }

    protected bindClientId(): BindingTarget<string> {
        return { constantValue: DiagramModule.FALLBACK_CLIENT_ID };
    }

    protected bindGModelSerializer(): BindingTarget<GModelSerializer> {
        return DefaultGModelSerializer;
    }

    protected bindGModelIndex(): BindingTarget<GModelIndex> {
        return GModelIndex;
    }

    protected bindActionDispatcher(): BindingTarget<ActionDispatcher> {
        return DefaultActionDispatcher;
    }

    protected bindActionHandlerRegistry(): BindingTarget<ActionHandlerRegistry> {
        return ActionHandlerRegistry;
    }

    protected bindOperationHandlerRegistry(): BindingTarget<OperationHandlerRegistry> {
        return OperationHandlerRegistry;
    }

    protected bindModelSubmissionHandler(): BindingTarget<ModelSubmissionHandler> {
        return ModelSubmissionHandler;
    }

    protected bindNavigationTargetProviderRegistry(): BindingTarget<NavigationTargetProviderRegistry> {
        return DefaultNavigationTargetProviderRegistry;
    }

    protected bindContextEditValidatorRegistry(): BindingTarget<ContextEditValidatorRegistry> {
        return DefaultContextEditValidatorRegistry;
    }

    protected bindActionHandlerFactory(): BindingTarget<ActionHandlerFactory> {
        return { dynamicValue: ctx => constructor => ctx.container.resolve(constructor) };
    }

    protected bindOperationHandlerFactory(): BindingTarget<OperationHandlerFactory> {
        return { dynamicValue: ctx => constructor => ctx.container.resolve(constructor) };
    }

    protected bindOperations(): BindingTarget<string[]> {
        return {
            dynamicValue: context =>
                context.container
                    .get<OperationHandlerConstructor[]>(OperationHandlerConstructor)
                    .map(constructor => new constructor().operationType)
        };
    }

    protected bindCommandStack(): BindingTarget<CommandStack> {
        return DefaultCommandStack;
    }

    protected configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        binding.add(CompoundOperationHandler);
        binding.add(LayoutOperationHandler);
    }

    protected configureContextActionProviders(binding: MultiBinding<ContextActionsProvider>): void {
        // empty as default
    }

    protected configureContextEditValidators(binding: MultiBinding<ContextEditValidator>): void {
        // empty as default
    }

    protected configureNavigationTargetProviders(binding: MultiBinding<NavigationTargetProvider>): void {
        // empty as default
    }

    protected configureClientActions(binding: InstanceMultiBinding<string>): void {
        binding.add(CenterAction.KIND);
        binding.add(ExportSvgAction.KIND);
        binding.add(DeleteMarkersAction.KIND);
        binding.add(FitToScreenAction.KIND);
        binding.add(SourceModelChangedAction.KIND);
        binding.add(NavigateToTargetAction.KIND);
        binding.add(NavigateToExternalTargetAction.KIND);
        binding.add(RequestBoundsAction.KIND);
        binding.add(SelectAction.KIND);
        binding.add(SelectAllAction.KIND);
        binding.add(ServerMessageAction.KIND);
        binding.add(SetBoundsAction.KIND);
        binding.add(SetClipboardDataAction.KIND);
        binding.add(SetContextActions.KIND);
        binding.add(SetDirtyStateAction.KIND);
        binding.add(SetEditModeAction.KIND);
        binding.add(SetEditValidationResultAction.KIND);
        binding.add(SetMarkersAction.KIND);
        binding.add(SetModelAction.KIND);
        binding.add(SetNavigationTargetsAction.KIND);
        binding.add(SetPopupModelAction.KIND);
        binding.add(SetResolvedNavigationTargetAction.KIND);
        binding.add(SetTypeHintsAction.KIND);
        binding.add(SetViewportAction.KIND);
        binding.add(ServerStatusAction.KIND);
        binding.add(TriggerNodeCreationAction.KIND);
        binding.add(TriggerEdgeCreationAction.KIND);
        binding.add(UpdateModelAction.KIND);
    }

    protected bindContextActionsProviderRegistry(): BindingTarget<ContextActionsProviderRegistry> {
        return ContextActionsProviderRegistry;
    }

    // Required abstract bindings

    protected abstract bindSourceModelStorage(): BindingTarget<SourceModelStorage>;

    /**
     * Returns the {@link BindingTarget} for the {@link ModelState} interface.
     * Typically a {@link ServiceTarget} is returned as this ensures that both
     * `@inject(ModelState)` and `@inject(MyCustomModelState`) can be used and resolve
     * to the same instance.
     *
     * Example:
     * ```ts
     *  protected override bindModelState():BindingTarget<ModelState> {
     *     return { service: MyCustomModelState};
     *  }
     *```
     */
    protected abstract bindModelState(): BindingTarget<ModelState>;

    protected abstract bindDiagramConfiguration(): BindingTarget<DiagramConfiguration>;

    protected abstract bindGModelFactory(): BindingTarget<GModelFactory>;

    // Optional bindings

    protected bindModelValidator(): BindingTarget<ModelValidator> | undefined {
        return undefined;
    }
    protected bindLabelEditValidator(): BindingTarget<LabelEditValidator> | undefined {
        return undefined;
    }

    protected bindToolPaletteItemProvider(): BindingTarget<ToolPaletteItemProvider> | undefined {
        return DefaultToolPaletteItemProvider;
    }
    protected bindCommandPaletteActionProvider(): BindingTarget<CommandPaletteActionProvider> | undefined {
        return undefined;
    }
    protected bindContextMenuItemProvider(): BindingTarget<ContextMenuItemProvider> | undefined {
        return undefined;
    }

    protected bindNavigationTargetResolver(): BindingTarget<NavigationTargetResolver> | undefined {
        return undefined;
    }

    protected bindPopupModelFactory(): BindingTarget<PopupModelFactory> | undefined {
        return undefined;
    }
    protected bindLayoutEngine(): BindingTarget<LayoutEngine> | undefined {
        return undefined;
    }
}
