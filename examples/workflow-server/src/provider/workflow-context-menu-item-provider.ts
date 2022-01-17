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
import { Args, ContextMenuItemProvider, CreateNodeOperation, GModelState, MenuItem, Point } from '@eclipse-glsp/server-node';
import { inject, injectable } from 'inversify';
import { GridSnapper } from '../handler/grid-snapper';
import { ModelTypes } from '../util/model-types';

@injectable()
export class WorkflowContextMenuItemProvider extends ContextMenuItemProvider {
    @inject(GModelState)
    protected modelState: GModelState;

    getItems(selectedElementIds: string[], position: Point, args?: Args): MenuItem[] {
        if (this.modelState.isReadonly) {
            return [];
        }
        const snappedPosition = GridSnapper.snap(position);
        const newAutTask = new MenuItem('newAutoTask', 'Automated Task', [
            new CreateNodeOperation(ModelTypes.AUTOMATED_TASK, snappedPosition)
        ]);
        const newManTask = new MenuItem('newManualTask', 'Manual Task', [new CreateNodeOperation(ModelTypes.MANUAL_TASK, snappedPosition)]);
        const newChildMenu = new MenuItem('new', 'New', undefined, [newAutTask, newManTask], 'add', '0_new');
        return [newChildMenu];
    }
}
