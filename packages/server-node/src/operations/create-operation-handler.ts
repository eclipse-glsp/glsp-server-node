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
import { GBoundsAware, GEdge, GGraph, GModelElement, GModelRoot, GNode, GPort, isGBoundsAware } from '@eclipse-glsp/graph';
import {
    Args,
    CreateEdgeOperation,
    CreateNodeOperation,
    CreateOperation,
    Operation,
    Point,
    SelectAction,
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { GModelState } from '../base-impl/gmodel-state';
import { OperationHandler } from './operation-handler';

/**
 * A special {@link OperationHandler} that is responsible for the handling of {@link CreateOperation}s. Depending on its
 * operation type the triggered actions are {@link TriggerNodeCreationAction} or {@link TriggerEdgeCreationAction}s.
 */
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

@injectable()
export abstract class CreateNodeOperationHandler extends CreateOperationHandler {
    @inject(GModelState)
    protected modelState: GModelState;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    get operationType(): string {
        return CreateNodeOperation.KIND;
    }

    abstract override elementTypeIds: string[];

    execute(operation: CreateNodeOperation): void {
        const container = this.getContainer(operation) ?? this.modelState.root;

        const absoluteLocation = this.getLocation(operation);
        const relativeLocation = this.getRelativeLocation(absoluteLocation, container);
        const element = this.createNode(relativeLocation, operation.args);
        if (element) {
            container.children.push(element);
            element.parent = container;
            this.actionDispatcher.dispatchAfterNextUpdate(SelectAction.create({ selectedElementsIDs: [element.id] }));
        }
    }

    getContainer(operation: CreateNodeOperation): GModelElement | undefined {
        const index = this.modelState.index;
        return operation.containerId ? index.get(operation.containerId) : undefined;
    }

    getLocation(operation: CreateNodeOperation): Point | undefined {
        return operation.location;
    }

    getRelativeLocation(absoluteLocation: Point | undefined, container: GModelElement | undefined): Point | undefined {
        if (absoluteLocation && container) {
            const allowNegativeCoordinates = container instanceof GGraph;
            if (isGBoundsAware(container)) {
                const relativePosition = absoluteToRelative(absoluteLocation, container);
                const relativeLocation = allowNegativeCoordinates
                    ? relativePosition
                    : { x: Math.max(0, relativePosition.x), y: Math.max(0, relativePosition.y) };
                return relativeLocation;
            }
        }
        return undefined;
    }

    abstract createNode(relativeLocation: Point | undefined, args: Args | undefined): GNode | undefined;
}

@injectable()
export abstract class CreateEdgeOperationHandler extends CreateOperationHandler {
    @inject(GModelState)
    protected modelState: GModelState;

    get operationType(): string {
        return CreateEdgeOperation.KIND;
    }

    execute(operation: CreateEdgeOperation): void {
        const index = this.modelState.index;

        const source = index.find(operation.sourceElementId, element => element instanceof GNode || element instanceof GPort);
        const target = index.find(operation.targetElementId, element => element instanceof GNode || element instanceof GPort);

        if (!source || !target) {
            throw new Error(
                `Invalid source or target for source ID ${operation.sourceElementId} and target ID ${operation.targetElementId}`
            );
        }

        const connection = this.createEdge(source, target, this.modelState);
        if (connection) {
            const currentModel = this.modelState.root;
            (currentModel as GModelElement).children.push(connection);
        }
    }

    abstract createEdge(source: GModelElement, target: GModelElement, modelState: GModelState): GEdge | undefined;
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
