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
import { GModelRootSchema } from '@eclipse-glsp/graph';
import {
    Action,
    DirtyStateChangeReason,
    MarkersReason,
    MaybePromise,
    RequestBoundsAction,
    RequestModelAction,
    SetDirtyStateAction,
    SetMarkersAction,
    SetModelAction,
    UpdateModelAction
} from '@eclipse-glsp/protocol';

import { inject, injectable, optional } from 'inversify';
import { CommandStack } from '../../command/command-stack';
import { DiagramConfiguration, ServerLayoutKind } from '../../diagram/diagram-configuration';
import { LayoutEngine } from '../layout/layout-engine';
import { ModelValidator } from '../validation/model-validator';
import { GModelFactory } from './gmodel-factory';
import { GModelSerializer } from './gmodel-serializer';
import { ModelState } from './model-state';

/**
 * Helper class that provides utility methods to handle model updates i.e.
 * submit a new model to the client. In addition, to the core model update action this class
 * also takes care of related behavior like dirty state handling, validation and client/server side layouting.
 * Note that the submissions handler is only responsible for deriving the set of actions that comprise a model update
 * but does not actually dispatch them. The returned actions should be either manually dispatched
 * to the `ActionDispatcher`, or simply returned as the result of an
 * `ActionHandler.execute` method.
 */
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

    @inject(CommandStack)
    protected commandStack: CommandStack;

    @inject(ModelValidator)
    @optional()
    protected validator?: ModelValidator;

    protected requestModelAction?: RequestModelAction;

    /**
     * Returns a list of actions to submit the initial revision of the client-side model, based on the injected
     * {@link GModelState}. Typically this method is invoked by the {@link RequestModelActionHandler} when the diagram
     * is (re)loaded.
     * <p>
     * These actions are not processed by this {@link ModelSubmissionHandler}, but should be either manually dispatched
     * to the {@link ActionDispatcher}, or simply returned as the result of an
     * {@link ActionHandler#execute(Action)} method.
     * </p>
     *
     * @param requestAction The {@link RequestModelAction} that triggere the initial model update
     * @return A list of actions to be processed in order to submit the intial model.
     *
     */
    submitInitialModel(requestAction: RequestModelAction): MaybePromise<Action[]> {
        /*
         * In the default update action flow a `RequestModelAction` does not directly trigger a `SetModelAction` response
         * (RequestModelAction (C) -> RequestBoundsAction (S) -> ComputedBoundsAction (C) -> SetModelACtion (S)
         * Therefore we temporarily store the action later retrival
         */
        this.requestModelAction = requestAction;
        return this.submitModel();
    }

    /**
     * Returns a list of actions to update the client-side model, based on the injected {@link ModelState}
     *
     * These actions are not processed by this {@link ModelSubmissionHandler}, but should be either manually dispatched
     * to the `ActionDispatcher`, or simply returned as the result of an `ActionHandler.execute()` method.
     *
     * @param reason The optional reason that caused the model update.
     * @returns A list of actions to be processed in order to submit the model.
     */
    submitModel(reason?: DirtyStateChangeReason): MaybePromise<Action[]> {
        this.modelFactory.createModel();

        const revision = this.requestModelAction ? 0 : this.modelState.root.revision! + 1;
        this.modelState.root.revision = revision;

        if (this.diagramConfiguration.needsClientLayout) {
            const root = this.serializeGModel();
            return [RequestBoundsAction.create(root), SetDirtyStateAction.create(this.commandStack.isDirty, { reason })];
        }
        return this.submitModelDirectly(reason);
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
    async submitModelDirectly(reason?: DirtyStateChangeReason): Promise<Action[]> {
        const root = this.serializeGModel();

        if (this.diagramConfiguration.layoutKind === ServerLayoutKind.AUTOMATIC && this.layoutEngine) {
            await this.layoutEngine.layout();
        }
        const result: Action[] = [];
        result.push(
            this.requestModelAction
                ? this.createSetModeAction(root)
                : UpdateModelAction.create(root, { animate: this.diagramConfiguration.animatedUpdate })
        );
        if (!this.diagramConfiguration.needsClientLayout) {
            result.push(SetDirtyStateAction.create(this.commandStack.isDirty, { reason }));
        }
        if (this.validator) {
            const markers = await this.validator.validate([this.modelState.root], MarkersReason.LIVE);
            result.push(SetMarkersAction.create(markers, { reason: MarkersReason.LIVE }));
        }
        return result;
    }

    protected createSetModeAction(newRoot: GModelRootSchema): SetModelAction {
        const responseId = this.requestModelAction?.requestId ?? '';
        const response = SetModelAction.create(newRoot, { responseId });
        this.requestModelAction = undefined;
        return response;
    }

    protected serializeGModel(): GModelRootSchema {
        return this.serializer.createSchema(this.modelState.root);
    }
}
