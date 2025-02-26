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
import { GModelRoot, GNode, isGBoundsAware } from '@eclipse-glsp/graph';
import { ChangeBoundsOperation, Dimension, ElementAndBounds, MaybePromise, Point } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { GModelOperationHandler } from './gmodel-operation-handler';

/**
 * Applies {@link ChangeBoundsOperation} directly to the GModel.
 */
@injectable()
export class GModelChangeBoundsOperationHandler extends GModelOperationHandler {
    operationType = ChangeBoundsOperation.KIND;

    createCommand(operation: ChangeBoundsOperation): MaybePromise<Command | undefined> {
        const newBounds = operation.newBounds.filter(element => this.hasChanged(element));
        if (newBounds.length === 0) {
            return undefined;
        }
        return this.commandOf(() => this.executeChangeBounds({ ...operation, newBounds }));
    }

    protected hasChanged(element: ElementAndBounds): boolean {
        const knownElement = this.modelState.index.find(element.elementId);
        if (!knownElement || !isGBoundsAware(knownElement)) {
            return true;
        }
        const sizeChanged = knownElement.size ? !Dimension.equals(knownElement.size, element.newSize) : true;
        if (sizeChanged) {
            return true;
        }
        return knownElement.position && element.newPosition ? !Point.equals(knownElement.position, element.newPosition) : true;
    }

    protected executeChangeBounds(operation: ChangeBoundsOperation): void {
        for (const element of operation.newBounds) {
            this.changeElementBounds(element.elementId, element.newSize, element.newPosition);
        }
    }

    protected changeElementBounds(elementId: string, newSize: Dimension, newPosition: Point | undefined): void {
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
