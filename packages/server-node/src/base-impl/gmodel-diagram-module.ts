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
import { injectable, interfaces } from 'inversify';
import { ActionHandlerConstructor } from '../actions/action-handler';
import { SaveModelActionHandler } from '../actions/save-model-action-handler';
import { ChangeBoundsOperationHandler } from '../base-impl/change-bounds-operation-handler';
import { applyBindingTarget, BindingTarget } from '../di/binding-target';
import { DiagramModule } from '../di/diagram-module';
import { InstanceMultiBinding } from '../di/multi-binding';
import { RequestClipboardDataActionHandler } from '../features/clipboard/request-clipboard-data-action-handler';
import { ApplyLabelEditOperationHandler } from '../features/directediting/apply-label-edit-operation-handler';
import { LayoutOperationHandler } from '../features/layout/layout-operation-handler';
import { GModelFactory, GModelFactoryNullImpl } from '../features/model/gmodel-factory';
import { GModelIndex } from '../features/model/gmodel-index';
import { ModelState } from '../features/model/model-state';
import { SourceModelStorage } from '../features/model/source-model-storage';
import { CutOperationHandler } from '../operations/cut-operation-handler';
import { OperationHandlerConstructor } from '../operations/operation-handler';
import { PasteOperationHandler } from '../operations/paste-operation-handler';
import { ReconnectEdgeOperationHandler } from '../operations/reconnect-edge-operation-handler';
import { ComputedBoundsActionHandler } from './computed-bounds-action-handler';
import { DeleteOperationHandler } from './delete-operation-handler';
import { GModelState } from './gmodel-state';
import { GModelStorage } from './gmodel-storage';

/**
 * Extension of the {@link DiagramModule} to provide GModel integration.
 *
 * Contains all bindings of {@link DiagramModule}.
 *
 * Additionally binds:
 * - {@link SourceModelStorage} to {@link GModelLoader}
 * - {@link CommandStack} to {@link DefaultCommandStack}
 * - {@link ModelState} to {@link GModelState}
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
    protected override configure(
        bind: interfaces.Bind,
        unbind: interfaces.Unbind,
        isBound: interfaces.IsBound,
        rebind: interfaces.Rebind
    ): void {
        super.configure(bind, unbind, isBound, rebind);
        const context = this.context;
        applyBindingTarget(context, GModelIndex, this.bindGModelIndex()).inSingletonScope();
    }

    protected override bindSourceModelStorage(): BindingTarget<SourceModelStorage> {
        return GModelStorage;
    }

    protected override bindGModelFactory(): BindingTarget<GModelFactory> {
        return GModelFactoryNullImpl;
    }

    protected override bindModelState(): BindingTarget<ModelState> {
        applyBindingTarget(this.context, GModelState, this.bindGModelState()).inSingletonScope();
        return { service: GModelState };
    }

    protected bindGModelState(): BindingTarget<GModelState> {
        return GModelState;
    }

    protected override configureActionHandlers(binding: InstanceMultiBinding<ActionHandlerConstructor>): void {
        super.configureActionHandlers(binding);
        binding.add(ComputedBoundsActionHandler);
        binding.add(SaveModelActionHandler);
        binding.add(RequestClipboardDataActionHandler);
    }

    protected bindGModelIndex(): BindingTarget<GModelIndex> {
        return GModelIndex;
    }

    protected override configureOperationHandlers(binding: InstanceMultiBinding<OperationHandlerConstructor>): void {
        super.configureOperationHandlers(binding);
        binding.add(ApplyLabelEditOperationHandler);
        binding.add(ChangeBoundsOperationHandler);
        binding.add(CutOperationHandler);
        binding.add(DeleteOperationHandler);
        binding.add(PasteOperationHandler);
        binding.add(ReconnectEdgeOperationHandler);
        binding.add(LayoutOperationHandler);
    }
}
