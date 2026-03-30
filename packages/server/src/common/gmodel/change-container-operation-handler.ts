/********************************************************************************
 * Copyright (c) 2022-2025 STMicroelectronics and others.
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
 * Applies {@link ChangeContainerOperation} directly to the GModel by moving
 * the specified element to the target container.
 */
@injectable()
export class GModelChangeContainerOperationHandler extends GModelOperationHandler {
    operationType = ChangeContainerOperation.KIND;

    createCommand(operation: ChangeContainerOperation): MaybePromise<Command | undefined> {
        return this.commandOf(() => this.executeChangeContainer(operation));
    }

    protected executeChangeContainer(operation: ChangeContainerOperation): void {
        const element = this.modelState.index.find(operation.elementId);
        if (!element) {
            return;
        }

        const container = this.getContainer(operation);
        if (!container) {
            return;
        }

        const relativeLocation = this.getRelativeLocation(operation);
        this.changeElementContainer(element, container, relativeLocation);
    }

    /**
     * Returns the actual container element to which the moved element should be added.
     * It is usually the target element ({@link ChangeContainerOperation.targetContainerId}),
     * but could also be e.g. an intermediate compartment, or even a different node.
     *
     * Override this method to redirect to an intermediate container such as a compartment.
     *
     * @param operation The change container operation.
     * @returns The container element or `undefined` if the target container could not be found.
     */
    getContainer(operation: ChangeContainerOperation): GModelElement | undefined {
        return this.modelState.index.find(operation.targetContainerId);
    }

    /**
     * Returns the absolute location from the operation.
     * Override this method to apply custom location processing (e.g. grid snapping).
     *
     * @param operation The change container operation.
     * @returns The absolute location or `undefined`.
     */
    getLocation(operation: ChangeContainerOperation): Point | undefined {
        return operation.location;
    }

    /**
     * Retrieves the diagram absolute location and the target container from the given {@link ChangeContainerOperation}
     * and converts the absolute location to coordinates relative to the given container.
     * Relative coordinates can only be retrieved if the given container element is part of
     * a hierarchy of {@link GBoundsAware} elements. This means each (recursive) parent element need to
     * implement {@link GBoundsAware}. If that is not the case this method returns `undefined`.
     *
     * @param operation The change container operation.
     * @returns The relative position or `undefined`.
     */
    getRelativeLocation(operation: ChangeContainerOperation): Point | undefined {
        const container = this.getContainer(operation) ?? this.modelState.root;
        const absoluteLocation = this.getLocation(operation) ?? Point.ORIGIN;
        return getRelativeLocation(absoluteLocation, container);
    }

    protected changeElementContainer(element: GModelElement, newParent: GModelElement, relativeLocation?: Point): void {
        const oldParent = element.parent;
        if (!oldParent || oldParent === newParent) {
            return;
        }

        // Remove from old parent
        const index = oldParent.children.indexOf(element);
        if (index !== -1) {
            oldParent.children.splice(index, 1);
        }

        if (isGBoundsAware(element) && relativeLocation) {
            element.position = relativeLocation;
        }

        // Add to new parent
        newParent.children.push(element);
        element.parent = newParent;
    }
}
