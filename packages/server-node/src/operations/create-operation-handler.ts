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
import { GBoundsAware, GGraph, GModelElement, GModelRoot, isGBoundsAware } from '@eclipse-glsp/graph';
import {
    CreateEdgeOperation,
    CreateNodeOperation,
    CreateOperation,
    Operation,
    Point,
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ModelState } from '../features/model/model-state';
import { OperationHandler } from './operation-handler';

/**
 * A special {@link OperationHandler} that is responsible for the handling of {@link CreateOperation}s. Depending on its
 * operation type the triggered actions are {@link TriggerNodeCreationAction} or {@link TriggerEdgeCreationAction}s.
 */
@injectable()
export abstract class CreateOperationHandler implements OperationHandler {
    abstract operationType: string;
    abstract readonly label: string;
    abstract elementTypeIds: string[];

    abstract execute(operation: Operation): void;

    /**
     * Returns a list of {@link TriggerElementCreationAction}s for registered element types.
     *
     * @returns A list of {@link TriggerElementCreationAction}s.
     */
    getTriggerActions(): (TriggerEdgeCreationAction | TriggerNodeCreationAction)[] {
        if (this.operationType === CreateNodeOperation.KIND) {
            return this.elementTypeIds.map(typeId => TriggerNodeCreationAction.create(typeId));
        } else if (this.operationType === CreateEdgeOperation.KIND) {
            return this.elementTypeIds.map(typeId => TriggerEdgeCreationAction.create(typeId));
        }
        return [];
    }

    handles(operation: CreateOperation): boolean {
        return this.elementTypeIds.includes(operation.elementTypeId);
    }
}

/**
 * Abstract base implementation for {@link CreateOperationHandler} that
 * create an element that is represented with a {@link GNode} in the graphical model.
 */
@injectable()
export abstract class CreateNodeOperationHandler extends CreateOperationHandler {
    @inject(ModelState)
    protected modelState: ModelState;

    get operationType(): string {
        return CreateNodeOperation.KIND;
    }

    /**
     * Retrieve the graphical model element that should contain the newly created {@link GNode}.
     * If `undefined` is returned the {@link GNode} should be added directly to the diagram root.
     * @param operation The currently handled operation.
     * @returns The container {@link GModeElement} or `undefined`.
     */
    getContainer(operation: CreateNodeOperation): GModelElement | undefined {
        const index = this.modelState.index;
        return operation.containerId ? index.get(operation.containerId) : undefined;
    }

    getLocation(operation: CreateNodeOperation): Point | undefined {
        return operation.location;
    }

    /**
     * Retrieves the diagram absolute location and the target container from the given {@link CreateNodeOperation}
     * and converts the absolute location to coordinates relative to the given container.
     *  Relative coordinates can only be retrieved if the given container element is part of
     * a hierarchy of {@link GBoundsAware} elements. This means each (recursive) parent element need to
     * implement {@link GBoundsAware}. If that is not the case this method returns `undefined`.
     * @param absoluteLocation The diagram absolute position.
     * @param container The container element.
     * @returns The relative position or `undefined`.
     */
    getRelativeLocation(operation: CreateNodeOperation): Point | undefined {
        const container = this.getContainer(operation) ?? this.modelState.root;
        const absoluteLocation = this.getLocation(operation) ?? Point.ORIGIN;
        const allowNegativeCoordinates = container instanceof GGraph;
        if (isGBoundsAware(container)) {
            const relativePosition = absoluteToRelative(absoluteLocation, container);
            const relativeLocation = allowNegativeCoordinates
                ? relativePosition
                : { x: Math.max(0, relativePosition.x), y: Math.max(0, relativePosition.y) };
            return relativeLocation;
        }
        return undefined;
    }
}

/**
 * Convert a point in absolute coordinates to a point relative to the specified GBoundsAware.
 * Note: this method only works if the specified {@link GBoundsAware} is part of a
 * hierarchy of {@link GBoundsAware}. If any of its parents (recursively) does not implement
 * {@link GBoundsAware}, this method will throw an exception.
 *
 * @param absolutePoint
 * @param modelElement
 * @returns
 *         A new point, relative to the coordinates space of the specified {@link GBoundsAware}
 * @throws Error if the modelElement is not part of a {@link GBoundsAware} hierarchy
 */
export function absoluteToRelative(absolutePoint: Point, modelElement: GModelElement & GBoundsAware): Point {
    let parentElement;
    if (!(modelElement instanceof GModelRoot)) {
        parentElement = modelElement.parent;
    }

    let relativeToParent: Point;
    if (!parentElement) {
        relativeToParent = { x: absolutePoint.x, y: absolutePoint.y };
    } else {
        if (!isGBoundsAware(parentElement)) {
            throw new Error(`The element is not part of a GBoundsAware hierarchy: ${modelElement}`);
        }
        relativeToParent = absoluteToRelative(absolutePoint, parentElement);
    }

    const x = modelElement.position?.x ?? 0;
    const y = modelElement.position?.y ?? 0;

    return { x: relativeToParent.x - x, y: relativeToParent.y - y };
}
