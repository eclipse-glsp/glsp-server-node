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
import { injectable } from 'inversify';
import { ActionHandlerConstructor } from '../actions/action-handler';
import { BindingTarget } from '../di/binding-target';
import { DiagramModule } from '../di/diagram-module';
import { InstanceMultiBinding } from '../di/multi-binding';
import { RequestClipboardDataActionHandler } from '../features/clipboard/request-clipboard-data-action-handler';
import { LayoutOperationHandler } from '../features/layout/layout-operation-handler';
import { GModelFactory, GModelFactoryNullImpl } from '../features/model/gmodel-factory';
import { DefaultModelState, ModelState } from '../features/model/model-state';
import { SaveModelActionHandler } from '../features/model/save-model-action-handler';
import { CutOperationHandler } from '../operations/cut-operation-handler';
import { OperationHandlerConstructor } from '../operations/operation-handler';
import { ApplyLabelEditOperationHandler } from './apply-label-edit-operation-handler';
import { ChangeBoundsOperationHandler } from './change-bounds-operation-handler';
import { ChangeRoutingPointsOperationHandler } from './change-routing-points-operation-handler';
import { ComputedBoundsActionHandler } from './computed-bounds-action-handler';
import { GModelDeleteOperationHandler } from './delete-operation-handler';
import { PasteOperationHandler } from './paste-operation-handler';
import { ReconnectEdgeOperationHandler } from './reconnect-edge-operation-handler';

/**
 * Extension of the {@link DiagramModule} to provide GModel integration.
 *
 * Contains all bindings of {@link DiagramModule}.
 *
 * Additionally binds:
 * - {@link CommandStack} to {@link DefaultCommandStack}
 * - {@link ModelState} to {@link ModelState}
 * - {@link GModelFactory} to {@link GModelFactoryNullImpl}
 * - {@link GModelIndex} to self
 * - {@link ComputedBoundsActionHandler} to {@link ActionHandler}
 * - {@link RequestClipboardDataActionHandler} to {@link ActionHandler}
 * - {@link ApplyLabelEditOperationHandler} to {@link OperationHandler}
 * - {@link ChangeBoundsOperationHandler} to {@link OperationHandler}
 * - {@link CutOperationHandler} to {@link OperationHandler}
 * - {@link PasteOperationHandler} to {@link OperationHandler}
 */
@injectable()
export abstract class GModelDiagramModule extends DiagramModule {
    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return GModelFactoryNullImpl;
    }

    protected bindModelState(): BindingTarget<ModelState> {
        return DefaultModelState;
    }

    protected override configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        super.configureActionHandlers(binding);
        binding.add(ComputedBoundsActionHandler);
        binding.add(SaveModelActionHandler);
        binding.add(RequestClipboardDataActionHandler);
    }

    protected override configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(ApplyLabelEditOperationHandler);
        binding.add(ChangeBoundsOperationHandler);
        binding.add(CutOperationHandler);
        binding.add(GModelDeleteOperationHandler);
        binding.add(PasteOperationHandler);
        binding.add(ReconnectEdgeOperationHandler);
        binding.add(LayoutOperationHandler);
        binding.add(ChangeRoutingPointsOperationHandler);
    }
}
