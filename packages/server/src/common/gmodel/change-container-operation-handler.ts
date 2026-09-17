/********************************************************************************
 * Copyright (c) 2025-2026 EclipseSource and others.
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
import { GModelElement, isGBoundsAware } from '@eclipse-glsp/graph';
import { ChangeContainerOperation, MaybePromise, Point } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { getRelativeLocation } from '../utils/layout-util';
import { GModelOperationHandler } from './gmodel-operation-handler';

/**
 * Applies {@link ChangeContainerOperation} directly to the GModel by re-parenting the element
 * from its current container to the target container.
 */
@injectable()
export class GModelChangeContainerOperationHandler extends GModelOperationHandler {
    operationType = ChangeContainerOperation.KIND;

    createCommand(operation: ChangeContainerOperation): MaybePromise<Command | undefined> {
        const element = this.modelState.index.find(operation.elementId);
        const targetContainer = this.getContainer(operation);
        if (!element || !targetContainer) {
            return undefined;
        }
        // resolve elements lazily inside the closure so that references remain valid
        // even when preceding commands in a CompoundCommand rebuild the model tree
        return this.commandOf(() => {
            const currentElement = this.modelState.index.find(operation.elementId);
            const currentContainer = this.getContainer(operation);
            if (currentElement && currentContainer) {
                this.executeChangeContainer(currentElement, currentContainer, operation.location);
            }
        });
    }

    /**
     * Returns the {@link GModelElement} that will receive the reparented element. By default this is the
     * target element referenced by {@link ChangeContainerOperation.targetContainerId}, but it could also
     * be e.g. an intermediate compartment or a different node. Subclasses can override this to redirect the
     * reparented element into another container.
     *
     * @param operation the operation to resolve the container for.
     * @returns the {@link GModelElement} that will contain the reparented element, or `undefined` if it cannot be resolved.
     */
    getContainer(operation: ChangeContainerOperation): GModelElement | undefined {
        return this.modelState.index.find(operation.targetContainerId);
    }

    protected executeChangeContainer(element: GModelElement, targetContainer: GModelElement, location?: Point): void {
        // remove from current parent
        const currentParent = element.parent;
        if (currentParent) {
            const index = currentParent.children.indexOf(element);
            if (index >= 0) {
                currentParent.children.splice(index, 1);
            }
        }
        // add to new parent
        targetContainer.children.push(element);
        element.parent = targetContainer;
        // update position relative to the new container
        if (location && isGBoundsAware(element)) {
            const relativeLocation = getRelativeLocation(location, targetContainer);
            if (relativeLocation) {
                element.position = relativeLocation;
            }
        }
    }
}
