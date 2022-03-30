/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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
/* eslint-disable no-restricted-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    CenterAction,
    DeleteMarkersAction,
    ExportSvgAction,
    FitToScreenAction,
    GLSPServerStatusAction,
    ModelSourceChangedAction,
    NavigateToExternalTargetAction,
    NavigateToTargetAction,
    RequestBoundsAction,
    SelectAction,
    SelectAllAction,
    ServerMessageAction,
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
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction,
    UpdateModelAction
} from '@eclipse-glsp/protocol';
import { interfaces } from 'inversify';
import { ActionDispatcher, DefaultActionDispatcher } from '../actions/action-dispatcher';
import { ActionHandlerConstructor, ActionHandlerFactory } from '../actions/action-handler';
import { ActionHandlerRegistry, ActionHandlerRegistryInitializer } from '../actions/action-handler-registry';
import { ClientActionHandler } from '../actions/client-action-handler';
import { RequestTypeHintsActionHandler } from '../diagram/request-type-hints-action-handler';
import { ContextActionsProvider } from '../features/contextactions/context-actions-provider';
import { ContextActionsProviderRegistry } from '../features/contextactions/context-actions-provider-registry';
import { RequestContextActionsHandler } from '../features/contextactions/request-context-actions-handler';
import { ContextEditValidator } from '../features/directediting/context-edit-validator';
import {
    ContextEditValidatorRegistry,
    DefaultContextEditValidatorRegistry
} from '../features/directediting/context-edit-validator-registry';
import { RequestEditValidationHandler } from '../features/directediting/request-edit-validation-handler';
import { DefaultGModelSerializer, GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { RequestModelActionHandler } from '../features/model/request-model-action-handler';
import { NavigationTargetProvider } from '../features/navigation/navigation-target-provider';
import {
    DefaultNavigationTargetProviderRegistry,
    NavigationTargetProviderRegistry
} from '../features/navigation/navigation-target-provider-registry';
import { RequestNavigationTargetsActionHandler } from '../features/navigation/request-navigation-targets-action-handler';
import { ResolveNavigationTargetsActionHandler } from '../features/navigation/resolve-navigation-targets-action-handler';
import { RequestPopupModelActionHandler } from '../features/popup/request-popup-model-action-handler';
import { RequestMarkersHandler } from '../features/validation/request-markers-handler';
import { CompoundOperationHandler } from '../operations/compound-operation-handler';
import { OperationActionHandler } from '../operations/operation-action-handler';
import { OperationHandlerConstructor, OperationHandlerFactory } from '../operations/operation-handler';
import { OperationHandlerRegistry, OperationHandlerRegistryInitializer } from '../operations/operation-handler-registry';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { GLSPModule } from './glsp-module';
import { ClassMultiBinding, InstanceMultiBinding } from './multi-binding';
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
 * diagram specific bindings, session specific bindings like the {@link GModelState} are configured
 *
 * Client session injectors are child injectors of a server injector and therefore inherit the bindings from
 * {@link ServerModule}.
 *
 * The following bindings are provided by this base configuration:
 * - {@link ClientId} to default
 * - {@link GModelSerializer}
 * - {@link ActionDispatcher}
 * - {@link ActionHandlerRegistry}
 * - {@link OperationHandlerRegistry}
 * - {@link ModelSubmissionHandler}
 * - {@link NavigationTargetProviderRegistry}
 * - {@link ContextActionsProviderRegistry}
 * - {@link ContextEditValidatorRegistry}
 * - {@link OperationHandler} as {@link InstanceMultiBinding<OperationHandlerConstructor>}
 * - {@link ActionHandler} as {@link InstanceMultiBinding<ActionHandlerConstructor>}
 * - {@link ClientSessionInitializer} as {@link ClassMultiBinding<ClientSessionInitializer>}
 * - {@link ClientActionKinds} as {@link InstanceMultiBinding<string>}
 * - {@link NavigationTargetProviders} as {@link ClassMultiBinding<NavigationTargetProvider>} (empty)
 * - {@link ContextActionsProviders} as {@link ClassMultiBinding<ContextActionsProvider>} (empty)
 * - {@link ContextEditValidators} as {@link ClassMultiBinding<ContextActionsProvider>} (empty)
 *
 * The following bindings are required in either a subclass or an additional module:
 * - {@link DiagramType} via the subclasses diagramType property
 * - {@link DiagramConfiguration}
 * - {@link SourceModelStorage}
 * - {@link GModelState}
 * - {@link GModelFactory}
 * - {@link CommandStack}
 *
 * The following bindings can be optionally added via a module:
 * - {@link ModelValidator}
 * - {@link LabelEditValidator}
 * - {@link CommandPaletteActionProvider}
 * - {@link ContextMenuItemProvider}
 * - {@link PopupModelFactory}
 * - {@link ToolPaletteItemProvider}
 * - {@link NavigationTargetResolver}
 */
export abstract class DiagramModule extends GLSPModule {
    static readonly FALLBACK_CLIENT_ID = 'FallbackClientId';
    abstract readonly diagramType: string;

    protected configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        bind(DiagramType).toConstantValue(this.diagramType);
        bind(ClientId).toConstantValue(DiagramModule.FALLBACK_CLIENT_ID);
        bind(GModelSerializer).to(DefaultGModelSerializer).inSingletonScope();
        bind(ActionDispatcher).to(DefaultActionDispatcher).inSingletonScope();
        bind(ActionHandlerRegistry).toSelf().inSingletonScope();
        bind(OperationHandlerRegistry).toSelf().inSingletonScope();
        bind(ModelSubmissionHandler).toSelf().inSingletonScope();
        bind(NavigationTargetProviderRegistry).to(DefaultNavigationTargetProviderRegistry).inSingletonScope();
        bind(ContextActionsProviderRegistry).toSelf().inSingletonScope();
        bind(ContextEditValidatorRegistry).to(DefaultContextEditValidatorRegistry).inSingletonScope();

        // factory bindings
        bind<ActionHandlerFactory>(ActionHandlerFactory).toDynamicValue(ctx => constructor => ctx.container.resolve(constructor));
        bind<OperationHandlerFactory>(OperationHandlerFactory).toDynamicValue(ctx => constructor => ctx.container.resolve(constructor));

        // bind Kinds
        bind<string[]>(Operations).toDynamicValue(context =>
            context.container
                .get<OperationHandlerConstructor[]>(OperationHandlerConstructor)
                .map(constructor => new constructor().operationType)
        );

        // multi-bindings
        this.configureMultiBinding(new ClassMultiBinding<ClientSessionInitializer>(ClientSessionInitializer), binding =>
            this.configureClientSessionInitializers(binding)
        );
        this.configureMultiBinding(new InstanceMultiBinding<ActionHandlerConstructor>(ActionHandlerConstructor), binding =>
            this.configureActionHandlers(binding)
        );
        this.configureMultiBinding(new InstanceMultiBinding<OperationHandlerConstructor>(OperationHandlerConstructor), binding =>
            this.configureOperationHandlers(binding)
        );
        this.configureMultiBinding(new InstanceMultiBinding<string>(ClientActionKinds), binding => this.configureClientActions(binding));
        this.configureMultiBinding(new ClassMultiBinding<NavigationTargetProvider>(NavigationTargetProviders), binding =>
            this.configureNavigationTargetProviders(binding)
        );
        this.configureMultiBinding(new ClassMultiBinding<ContextActionsProvider>(ContextActionsProviders), binding =>
            this.configureContextActionProviders(binding)
        );
        this.configureMultiBinding(new ClassMultiBinding<ContextEditValidator>(ContextEditValidators), binding =>
            this.configureContextEditValidators(binding)
        );
    }

    configureClientSessionInitializers(binding: ClassMultiBinding<ClientSessionInitializer>): void {
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
    }

    protected configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        binding.add(CompoundOperationHandler);
    }

    protected configureContextActionProviders(binding: ClassMultiBinding<ContextActionsProvider>): void {
        // empty as default
    }

    protected configureContextEditValidators(binding: ClassMultiBinding<ContextEditValidator>): void {
        // empty as default
    }

    protected configureNavigationTargetProviders(binding: ClassMultiBinding<NavigationTargetProvider>): void {
        // empty as default
    }

    protected configureClientActions(binding: InstanceMultiBinding<string>): void {
        binding.add(CenterAction.KIND);
        binding.add(ExportSvgAction.KIND);
        binding.add(DeleteMarkersAction.KIND);
        binding.add(FitToScreenAction.KIND);
        binding.add(ModelSourceChangedAction.KIND);
        binding.add(NavigateToTargetAction.KIND);
        binding.add(NavigateToExternalTargetAction.KIND);
        binding.add(RequestBoundsAction.KIND);
        binding.add(SelectAction.KIND);
        binding.add(SelectAllAction.KIND);
        binding.add(ServerMessageAction.KIND);
        // binding.add(SetBoundsAction.KIND); TODO: Add missing action to protocol
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
        // binding.add(SetViewportAction.KIND);  TODO: Add missing action to protocol
        binding.add(GLSPServerStatusAction.KIND);
        binding.add(TriggerNodeCreationAction.KIND);
        binding.add(TriggerEdgeCreationAction.KIND);
        binding.add(UpdateModelAction.KIND);
    }
}
