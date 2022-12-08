/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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

import { Action, MaybePromise, RedoOperation, UndoOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { ModelSubmissionHandler } from '../model/model-submission-handler';
import { CommandStack } from './command-stack';

@injectable()
export class UndoRedoActionHandler implements ActionHandler {
    @inject(CommandStack)
    protected commandStack: CommandStack;

    @inject(ModelSubmissionHandler)
    protected modelSubmissionHandler: ModelSubmissionHandler;

    readonly actionKinds = [UndoOperation.KIND, RedoOperation.KIND];

    execute(action: Action): MaybePromise<Action[]> {
        if (UndoOperation.is(action)) {
            return this.undo();
        } else if (RedoOperation.is(action)) {
            return this.redo();
        }
        return [];
    }

    protected undo(): Action[] {
        if (this.commandStack.canUndo()) {
            this.commandStack.undo();
            return this.modelSubmissionHandler.submitModel('undo');
        }
        return [];
    }

    protected redo(): Action[] {
        if (this.commandStack.canRedo()) {
            this.commandStack.redo();
            return this.modelSubmissionHandler.submitModel('redo');
        }
        return [];
    }
}
