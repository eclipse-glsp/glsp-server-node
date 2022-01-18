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
import { GEdge, GGraph, GModelElement, GNode, GPort, isGBoundsAware } from '@eclipse-glsp/graph';
import {
    Args,
    CreateEdgeOperation,
    CreateNodeOperation,
    CreateOperation,
    Operation,
    Point,
    SelectAction,
    TriggerEdgeCreationAction,
    TriggerElementCreationAction,
    TriggerNodeCreationAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { GModelState } from '../base-impl/gmodel-state';
import { absoluteToRelative } from '../utils/geometry-util';
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
    getTriggerActions(): TriggerElementCreationAction[] {
        if (this.operationType === CreateNodeOperation.KIND) {
            return this.elementTypeIds.map(typeId => new TriggerNodeCreationAction(typeId));
        } else if (this.operationType === CreateEdgeOperation.KIND) {
            return this.elementTypeIds.map(typeId => new TriggerEdgeCreationAction(typeId));
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

    abstract elementTypeIds: string[];

    execute(operation: CreateNodeOperation): void {
        const container = this.getContainer(operation) ?? this.modelState.root;

        const absoluteLocation = this.getLocation(operation);
        const relativeLocation = this.getRelativeLocation(absoluteLocation, container);
        const element = this.createNode(relativeLocation, operation.args);
        if (element) {
            container.children.push(element);
            element.parent = container;
            this.actionDispatcher.dispatchAfterNextUpdate(new SelectAction(), new SelectAction([element.id]));
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
