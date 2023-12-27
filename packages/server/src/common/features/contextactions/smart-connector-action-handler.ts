/********************************************************************************
 * Copyright (c) 2023 Business Informatics Group (TU Wien) and others.
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
    Action,
    CloseSmartConnectorAction,
    OpenSmartConnectorAction,
    SelectAction,
    MaybePromise} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { ModelState } from '../model/model-state';
import { GNode } from '@eclipse-glsp/graph';

@injectable()
export class OpenSmartConnectorActionHandler implements ActionHandler {
    actionKinds = [SelectAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    execute(action: Action): MaybePromise<Action[]> {
        if (SelectAction.is(action)) {
            const selectedElement = this.modelState.index.find(action.selectedElementsIDs[0]);
            if (selectedElement && selectedElement instanceof GNode) {
                return [OpenSmartConnectorAction.create(action.selectedElementsIDs[0])];
            }
            else {return [];}
        }
        return [CloseSmartConnectorAction.create()];
    }
}
