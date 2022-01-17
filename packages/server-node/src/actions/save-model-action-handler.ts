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
import { Action, MaybePromise, SaveModelAction, SetDirtyStateAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { GModelState } from '../base-impl/gmodel-state';
import { ClientOptionsUtil } from '../utils/client-options-util';
import { ActionHandler } from './action-handler';
import { writeFileSync } from 'fs';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { GLSPServerError } from '../utils/glsp-server-error';

@injectable()
export class SaveModelActionHandler implements ActionHandler {
    actionKinds = [SaveModelAction.KIND];

    @inject(GModelState)
    protected modelState: GModelState;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    execute(action: Action): MaybePromise<Action[]> {
        this.saveModelState(action);
        return [new SetDirtyStateAction(this.modelState.isDirty)]; // TODO: set reason to SAVE
    }

    protected saveModelState(action: SaveModelAction): void {
        try {
            const data = this.modelSerializer.createSchema(this.modelState.root);
            // eslint-disable-next-line no-null/no-null
            writeFileSync(this.modelState.sourceUri!, JSON.stringify(data, null, 2));
            if (this.saveIsDone(action)) {
                // TODO: call save is done when available
            }
        } catch (err) {
            throw new GLSPServerError(`An error occured during save process: ${err}`);
        }
    }

    protected saveIsDone(action: SaveModelAction): boolean {
        const sourceUri = this.modelState.sourceUri;
        return action.fileUri ? ClientOptionsUtil.adaptUri(action.fileUri) === sourceUri : true;
    }
}
