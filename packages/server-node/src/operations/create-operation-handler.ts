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
import { GModelElement } from '@eclipse-glsp/graph';
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
import { getRelativeLocation } from '../utils/layout-util';
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
        return getRelativeLocation(absoluteLocation, container);
    }
}
