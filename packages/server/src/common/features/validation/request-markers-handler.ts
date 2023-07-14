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
import { Action, MarkersReason, RequestMarkersAction, SetMarkersAction } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { GLSPServerError } from '../../utils/glsp-server-error';
import { ModelState } from '../model/model-state';
import { ModelValidator } from './model-validator';

@injectable()
export class RequestMarkersHandler implements ActionHandler {
    actionKinds = [RequestMarkersAction.KIND];

    @inject(ModelValidator) @optional() validator: ModelValidator;
    @inject(ModelState) modelState: ModelState;

    async execute(action: RequestMarkersAction): Promise<Action[]> {
        let elementIDs = action.elementsIDs;
        if (!this.validator) {
            throw new GLSPServerError('Cannot compute markers! No implementation for ModelValidator has been bound');
        }

        if (!elementIDs || elementIDs.length === 0 || (elementIDs.length === 1 && elementIDs[0] === 'EMPTY')) {
            elementIDs = [this.modelState.root.id];
        }

        const modelElements = this.modelState.index.getAll(elementIDs);
        const markers = await this.validator.validate(modelElements, action.reason ?? MarkersReason.BATCH);

        return [SetMarkersAction.create(markers)];
    }
}
