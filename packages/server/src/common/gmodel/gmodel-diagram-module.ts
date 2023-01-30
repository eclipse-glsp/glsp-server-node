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
import { GModelFactory, GModelFactoryNullImpl } from '../features/model/gmodel-factory';
import { DefaultModelState, ModelState } from '../features/model/model-state';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OperationHandler, OperationHandlerConstructor } from '../operations/operation-handler';
import { GModelApplyLabelEditOperationHandler } from './apply-label-edit-operation-handler';
import { GModelChangeBoundsOperationHandler } from './change-bounds-operation-handler';
import { GModelChangeRoutingPointsOperationHandler } from './change-routing-points-operation-handler';
import { GModelCutOperationHandler } from './cut-operation-handler';
import { GModelDeleteOperationHandler } from './delete-operation-handler';
import { GModelPasteOperationHandler } from './paste-operation-handler';
import { GModelReconnectEdgeOperationHandler } from './reconnect-edge-operation-handler';

/**
 * Extension of the {@link DiagramModule} to provide GModel integration.
 *
 * Contains all bindings of {@link DiagramModule}.
 *
 * Additionally binds:
 * - {@link GModelFactory} to {@link GModelFactoryNullImpl}
 * - {@link RequestClipboardDataActionHandler} to {@link ActionHandler}
 * - {@link GModelApplyLabelEditOperationHandler} to {@link OperationHandler}
 * - {@link GModelChangeBoundsOperationHandler} to {@link OperationHandler}
 * - {@link GModelCutOperationHandler} to {@link OperationHandler}
 * - {@link GModelDeleteOperationHandler} to {@link OperationHandler}
 * - {@link GModelPasteOperationHandler} to {@link OperationHandler}
 * - {@link GModelReconnectEdgeOperationHandler} to {@link OperationHandler}
 * - {@link GModelChangeRoutingPointsOperationHandler} to {@link OperationHandler}

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
        binding.add(RequestClipboardDataActionHandler);
    }

    protected override configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(GModelApplyLabelEditOperationHandler);
        binding.add(GModelChangeBoundsOperationHandler);
        binding.add(GModelCutOperationHandler);
        binding.add(GModelDeleteOperationHandler);
        binding.add(GModelPasteOperationHandler);
        binding.add(GModelReconnectEdgeOperationHandler);
        binding.add(GModelChangeRoutingPointsOperationHandler);
    }
}
