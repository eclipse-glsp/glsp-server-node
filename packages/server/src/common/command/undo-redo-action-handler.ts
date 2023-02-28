/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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

import { Action, MaybePromise, RedoAction, UndoAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { CommandStack } from './command-stack';

@injectable()
export class UndoRedoActionHandler implements ActionHandler {
    @inject(CommandStack)
    protected commandStack: CommandStack;

    @inject(ModelSubmissionHandler)
    protected modelSubmissionHandler: ModelSubmissionHandler;

    readonly actionKinds = [UndoAction.KIND, RedoAction.KIND];

    execute(action: Action): MaybePromise<Action[]> {
        if (UndoAction.is(action)) {
            return this.undo();
        } else if (RedoAction.is(action)) {
            return this.redo();
        }
        return [];
    }

    protected async undo(): Promise<Action[]> {
        if (this.commandStack.canUndo()) {
            await this.commandStack.undo();
            return this.modelSubmissionHandler.submitModel('undo');
        }
        return [];
    }

    protected async redo(): Promise<Action[]> {
        if (this.commandStack.canRedo()) {
            await this.commandStack.redo();
            return this.modelSubmissionHandler.submitModel('redo');
        }
        return [];
    }
}
