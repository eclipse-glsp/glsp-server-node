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
import {
    ClassMultiBinding,
    CommandPaletteActionProvider,
    ContextMenuItemProvider,
    DefaultToolPaletteItemProvider,
    DiagramConfiguration,
    GLSPServer,
    GModelDiagramModule,
    InstanceMultiBinding,
    JsonRpcGLSPServer,
    LabelEditValidator,
    ModelValidator,
    NavigationTargetProvider,
    NavigationTargetResolver,
    OperationHandlerConstructor,
    PopupModelFactory,
    ServerModule,
    ToolPaletteItemProvider
} from '@eclipse-glsp/server-node';
import { injectable, interfaces } from 'inversify';
import { CreateAutomatedTaskHandler } from './handler/create-automated-task-handler';
import { CreateCategoryHandler } from './handler/create-category-handler';
import { CreateDecisionNodeHandler } from './handler/create-decision-node-handler';
import { CreateEdgeHandler } from './handler/create-edge-handler';
import { CreateForkNodeHandler } from './handler/create-fork-node-handler';
import { CreateJoinNodeHandler } from './handler/create-join-node-handler';
import { CreateManualTaskHandler } from './handler/create-manual-task-handler';
import { CreateMergeNodeHandler } from './handler/create-merge-node-handler';
import { CreateWeightedEdgeHandler } from './handler/create-weighted-edge-handler';
import { WorkflowLabelEditValidator } from './labeledit/workflow-label-edit-validator';
import { WorkflowModelValidator } from './marker/workflow-model-validator';
import { WorkflowNavigationTargetResolver } from './model/workflow-navigation-target-resolver';
import { NextNodeNavigationTargetProvider } from './provider/next-node-navigation-target-provider';
import { NodeDocumentationNavigationTargetProvider } from './provider/node-documentation-navigation-target-provider';
import { PreviousNodeNavigationTargetProvider } from './provider/previous-node-navigation-target-provider';
import { WorkflowCommandPaletteActionProvider } from './provider/workflow-command-palette-action-provider';
import { WorkflowContextMenuItemProvider } from './provider/workflow-context-menu-item-provider';
import { WorkflowDiagramConfiguration } from './workflow-diagram-configuration';
import { WorkflowGLSPServer } from './workflow-glsp-server';
import { WorkflowPopupFactory } from './workflow-popup-factory';

@injectable()
export class WorkflowServerModule extends ServerModule {
    configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);
        bind(WorkflowGLSPServer).toSelf().inSingletonScope();
        rebind(GLSPServer).toService(WorkflowGLSPServer);
        rebind(JsonRpcGLSPServer).toService(WorkflowGLSPServer);
    }
}

@injectable()
export class WorkflowDiagramModule extends GModelDiagramModule {
    get diagramType(): string {
        return 'workflow-diagram';
    }

    protected configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        super.configure(bind, unbind, isBound, rebind);
        bind(DiagramConfiguration).to(WorkflowDiagramConfiguration).inSingletonScope();
        bind(NavigationTargetResolver).to(WorkflowNavigationTargetResolver).inSingletonScope();
        bind(ContextMenuItemProvider).to(WorkflowContextMenuItemProvider).inSingletonScope();
        bind(CommandPaletteActionProvider).to(WorkflowCommandPaletteActionProvider).inSingletonScope();
        bind(LabelEditValidator).to(WorkflowLabelEditValidator).inSingletonScope();
        bind(PopupModelFactory).to(WorkflowPopupFactory).inSingletonScope();
        bind(ModelValidator).to(WorkflowModelValidator).inSingletonScope();
        bind(ToolPaletteItemProvider).to(DefaultToolPaletteItemProvider).inSingletonScope();
    }

    protected configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(CreateAutomatedTaskHandler);
        binding.add(CreateManualTaskHandler);
        binding.add(CreateJoinNodeHandler);
        binding.add(CreateForkNodeHandler);
        binding.add(CreateEdgeHandler);
        binding.add(CreateWeightedEdgeHandler);
        binding.add(CreateMergeNodeHandler);
        binding.add(CreateDecisionNodeHandler);
        binding.add(CreateCategoryHandler);
    }

    protected configureNavigationTargetProviders(binding: ClassMultiBinding<NavigationTargetProvider>): void {
        super.configureNavigationTargetProviders(binding);
        binding.add(NextNodeNavigationTargetProvider);
        binding.add(PreviousNodeNavigationTargetProvider);
        binding.add(NodeDocumentationNavigationTargetProvider);
    }
}
