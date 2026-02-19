/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
    ClipboardData,
    GModelElementSchema,
    MaybePromise,
    RequestClipboardDataAction,
    SetClipboardDataAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { GModelSerializer } from '../model/gmodel-serializer';
import { ModelState } from '../model/model-state';

@injectable()
export class RequestClipboardDataActionHandler implements ActionHandler {
    actionKinds = [RequestClipboardDataAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    execute(action: RequestClipboardDataAction): MaybePromise<Action[]> {
        const schemas: GModelElementSchema[] = [];
        const index = this.modelState.index;
        const selectedElements = index.getAll(action.editorContext.selectedElementIds);
        const clipboardData: ClipboardData = { format: 'application/json' };
        selectedElements.forEach(element => {
            schemas.push(this.modelSerializer.createSchema(element));
        });

        clipboardData['application/json'] = JSON.stringify(schemas, undefined, 2);
        return [SetClipboardDataAction.create(clipboardData)];
    }
}
