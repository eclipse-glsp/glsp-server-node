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
import { Action, MaybePromise, RequestPopupModelAction, SetPopupModelAction } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { GLSPServerError } from '../../utils/glsp-server-error';
import { Logger } from '../../utils/logger';
import { GModelSerializer } from '../model/gmodel-serializer';
import { ModelState } from '../model/model-state';
import { PopupModelFactory } from './popup-model-factory';

@injectable()
export class RequestPopupModelActionHandler implements ActionHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(PopupModelFactory)
    @optional()
    protected popupModelFactory?: PopupModelFactory;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    actionKinds = [RequestPopupModelAction.KIND];

    execute(action: RequestPopupModelAction): MaybePromise<Action[]> {
        if (this.popupModelFactory) {
            const hoverElement = this.modelState.index.find(action.elementId);
            if (hoverElement) {
                const popupModel = this.popupModelFactory.createPopupModel(hoverElement, action);
                if (popupModel) {
                    const modelSchema = this.modelSerializer.createSchema(popupModel);
                    return [SetPopupModelAction.create(modelSchema)];
                }
                return [];
            }
            throw new GLSPServerError(`Could not process 'RequestPopupModelAction'. Hover element with id ${action.elementId} not found`);
        }
        this.logger.warn('Could not process `RequestPopupModelAction`. No `PopupModelFactory` is bound');
        return [];
    }

    priority?: number | undefined;
}
