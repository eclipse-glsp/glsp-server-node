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
import { ActionHandler } from '../../actions/action-handler';
import { GLSPServerError } from '../../utils/glsp-server-error';
import { CommandStack } from '../undo-redo/command-stack';
import { ModelState } from './model-state';
import { SourceModelStorage } from './source-model-storage';

@injectable()
export class SaveModelActionHandler implements ActionHandler {
    actionKinds = [SaveModelAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(SourceModelStorage)
    protected sourceModelStorage: SourceModelStorage;

    @inject(CommandStack)
    protected commandStack: CommandStack;

    execute(action: SaveModelAction): MaybePromise<Action[]> {
        try {
            this.sourceModelStorage.saveSourceModel(action);
            this.commandStack.saveIsDone();
        } catch (err) {
            throw new GLSPServerError(`An error occurred during save process: ${err}`);
        }
        return [SetDirtyStateAction.create(this.commandStack.isDirty, { reason: 'save' })];
    }
}
