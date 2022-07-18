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
import { GModelRoot, GNode } from '@eclipse-glsp/graph';
import { ChangeBoundsOperation, Dimension, Point } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ModelState } from '../features/model/model-state';
import { OperationHandler } from '../operations/operation-handler';

@injectable()
export class ChangeBoundsOperationHandler implements OperationHandler {
    operationType = ChangeBoundsOperation.KIND;

    @inject(ModelState)
    protected modelState: ModelState;

    execute(operation: ChangeBoundsOperation): void {
        for (const element of operation.newBounds) {
            this.changeElementBounds(element.elementId, element.newSize, element.newPosition);
        }
    }

    changeElementBounds(elementId: string, newSize: Dimension, newPosition: Point | undefined): void {
        const index = this.modelState.index;
        const nodeToUpdate = index.findByClass(elementId, GNode);
        if (!nodeToUpdate) {
            return;
        }

        const parent = nodeToUpdate.parent;
        let positionToSet = { x: 0, y: 0 };
        if (newPosition) {
            positionToSet = parent instanceof GModelRoot ? newPosition : { x: Math.max(0, newPosition.x), y: Math.max(0, newPosition.y) };
        }
        if (nodeToUpdate.layout) {
            if (!nodeToUpdate.layoutOptions) {
                nodeToUpdate.layoutOptions = {};
            }
            nodeToUpdate.layoutOptions['prefWidth'] = newSize.width;
            nodeToUpdate.layoutOptions['prefHeight'] = newSize.height;
        }

        nodeToUpdate.size = newSize;
        nodeToUpdate.position = positionToSet;
    }
}
