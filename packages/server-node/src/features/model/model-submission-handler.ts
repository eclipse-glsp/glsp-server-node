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
import { GModelRootSchema } from '@eclipse-glsp/graph';
import { Action, RequestBoundsAction, SetDirtyStateAction, SetModelAction, UpdateModelAction } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { DiagramConfiguration, ServerLayoutKind } from '../../diagram/diagram-configuration';
import { LayoutEngine } from '../layout/layout-engine';
import { GModelFactory } from './gmodel-factory';
import { GModelSerializer } from './gmodel-serializer';
import { ModelState } from './model-state';

@injectable()
export class ModelSubmissionHandler {
    @inject(DiagramConfiguration)
    protected diagramConfiguration: DiagramConfiguration;

    @inject(GModelSerializer)
    protected serializer: GModelSerializer;

    @inject(GModelFactory)
    protected modelFactory: GModelFactory;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(LayoutEngine)
    @optional()
    protected layoutEngine: LayoutEngine;

    /**
     * Returns a list of actions to update the client-side model, based on the specified <code>modelState</code>.
     *
     * These actions are not processed by this {@link ModelSubmissionHandler}, but should be either manually dispatched
     * to the `ActionDispatcher`, or simply returned as the result of an `ActionHandler.execute()` method.
     *
     * @param reason The optional reason that caused the model update.
     * @returns A list of actions to be processed in order to submit the model.
     */
    submitModel(reason?: string): Action[] {
        this.modelFactory.createModel();
        this.modelState.root.revision = (this.modelState.root.revision ?? 0) + 1;
        const root = this.serializeGModel();

        if (this.diagramConfiguration.needsClientLayout) {
            return [new RequestBoundsAction(root), new SetDirtyStateAction(this.modelState.isDirty, reason)];
        }
        return [new SetModelAction(root)];
    }

    /**
     * Returns a list of actions to directly update the client-side model without any server- or client-side layouting.
     *
     * Typically `ActionHandler`s don't invoke this method but use {@link submitModel()}
     * instead, as this is only used to eventually submit the model on the client directly after all layouting is already
     * performed before. The only foreseen caller of this method is `ComputedBoundsActionHandler`.
     *
     * These actions are not processed by this {@link ModelSubmissionHandler}, but should be either manually dispatched
     * to the `ActionDispatcher`, or simply returned as the result of an
     * `ActionHandler.execute()` method.
     *
     * @param reason The optional reason that caused the model update.
     * @returns A list of actions to be processed in order to submit the model.
     */
    submitModelDirectly(reason?: string): Action[] {
        const root = this.serializeGModel();

        if (this.diagramConfiguration.layoutKind === ServerLayoutKind.AUTOMATIC && this.layoutEngine) {
            this.layoutEngine.layout();
        }
        const result: Action[] = [];
        result.push(root.revision === 0 ? new SetModelAction(root) : new UpdateModelAction(root, this.diagramConfiguration.animatedUpdate));
        if (!this.diagramConfiguration.needsClientLayout) {
            result.push(new SetDirtyStateAction(this.modelState.isDirty, reason));
        }
        return result;
    }

    protected serializeGModel(): GModelRootSchema {
        return this.serializer.createSchema(this.modelState.root);
    }
}
