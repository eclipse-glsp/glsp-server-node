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
import { CutOperation, DeleteElementOperation, MaybePromise } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { Command } from '../command/command';
import { GModelOperationHandler } from './gmodel-operation-handler';

@injectable()
export class GModelCutOperationHandler extends GModelOperationHandler {
    readonly operationType = CutOperation.KIND;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    createCommand(operation: CutOperation): MaybePromise<Command | undefined> {
        const cuttableElementIds = this.getElementToCut(operation);
        // If we have cuttable elements we dispatch a DeleteElementOperation otherwise do nothing
        if (cuttableElementIds.length > 0) {
            this.actionDispatcher.dispatch(DeleteElementOperation.create(cuttableElementIds));
        }
        return undefined;
    }

    protected getElementToCut(cutOperation: CutOperation): string[] {
        return cutOperation.editorContext.selectedElementIds;
    }
}
