/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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

import { GModelElement, GNode } from '@eclipse-glsp/graph';
import { CreateNodeOperation, MaybePromise, Point, SelectAction, TriggerNodeCreationAction,
    CreateEdgeOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { Command } from '../command/command';
import { CreateNodeOperationHandler } from '../operations/create-operation-handler';
import { getRelativeLocation } from '../utils/layout-util';
import { GModelOperationHandler } from './gmodel-operation-handler';

/**
 * An abstract base implementation of {@link CreateNodeOperationHandler} for diagram implementations
 * where the graphical model is also directly used as source model.
 * (i.e. all operation handlers directly modify the graphical model).
 */
@injectable()
export abstract class GModelCreateNodeOperationHandler extends GModelOperationHandler implements CreateNodeOperationHandler {
    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    abstract elementTypeIds: string[];

    abstract override label: string;

    override readonly operationType = CreateNodeOperation.KIND;

    override createCommand(operation: CreateNodeOperation): MaybePromise<Command | undefined> {
        return this.commandOf(() => this.executeCreation(operation));
    }

    executeCreation(operation: CreateNodeOperation): void {
        const container = this.getContainer(operation) ?? this.modelState.root;
        const relativeLocation = this.getRelativeLocation(operation);
        const element = this.createNode(operation, relativeLocation);
        if (element) {
            container.children.push(element);
            element.parent = container;
            this.actionDispatcher.dispatchAfterNextUpdate(SelectAction.create({ selectedElementsIDs: [element.id] }));
            // Creates default edge on node creation when a source ID is given in the CreateNodeOperation
            if (operation.args?.createEdge && operation.args?.edgeType) {
                this.actionDispatcher.dispatchAfterNextUpdate(CreateEdgeOperation.create({
                    elementTypeId: operation.args?.edgeType as string,
                    sourceElementId: operation.args?.source as string,
                    targetElementId: element.id
                }));
            }
        }
    }

    getTriggerActions(): TriggerNodeCreationAction[] {
        return this.elementTypeIds.map(typeId => TriggerNodeCreationAction.create(typeId));
    }

    /**
     * Return the GModelElement that will contain the newly created node. It is usually
     * the target element ({@link CreateNodeOperation.containerId}), but could also
     * be e.g. an intermediate compartment, or even a different Node.
     *
     * @param operation
     * @return the GModelElement that will contain the newly created node.
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

    abstract createNode(operation: CreateNodeOperation, relativeLocation?: Point): GNode | undefined;
}
