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
    Action,
    ClipboardData,
    MaybePromise,
    RequestClipboardDataAction,
    SetClipboardDataAction,
    SModelElementSchema
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { GModelState } from '../../base-impl/gmodel-state';
import { GModelSerializer } from '../model/gmodel-serializer';

@injectable()
export class RequestClipboardDataActionHandler implements ActionHandler {
    actionKinds = [RequestClipboardDataAction.KIND];

    @inject(GModelState)
    protected modelState: GModelState;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    execute(action: RequestClipboardDataAction): MaybePromise<Action[]> {
        const schemas: SModelElementSchema[] = [];
        const index = this.modelState.index;
        const selectedElements = index.getAll(action.editorContext.selectedElementIds);
        const clipboardData: ClipboardData = { format: 'application/json' };
        selectedElements.forEach(element => {
            schemas.push(this.modelSerializer.createSchema(element));
        });
        // eslint-disable-next-line no-null/no-null
        clipboardData['application/json'] = JSON.stringify(schemas, undefined, 2);
        return [SetClipboardDataAction.create(clipboardData)];
    }
}
