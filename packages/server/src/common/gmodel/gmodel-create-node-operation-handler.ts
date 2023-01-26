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

import { GNode } from '@eclipse-glsp/graph';
import { CreateNodeOperation, Point, SelectAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { CreateNodeOperationHandler } from '../operations/create-operation-handler';

/**
 * An abstract base implementation of {@link CreateNodeOperationHandler} for diagram implementations
 * where the graphical model is also directly used as source model.
 * (i.e. all operation handlers directly modify the graphical model).
 */
@injectable()
export abstract class GModelCreateNodeOperationHandler extends CreateNodeOperationHandler {
    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    abstract override elementTypeIds: string[];

    execute(operation: CreateNodeOperation): void {
        const container = this.getContainer(operation) ?? this.modelState.root;
        const relativeLocation = this.getRelativeLocation(operation);
        const element = this.createNode(operation, relativeLocation);
        if (element) {
            container.children.push(element);
            element.parent = container;
            this.actionDispatcher.dispatchAfterNextUpdate(SelectAction.create({ selectedElementsIDs: [element.id] }));
        }
    }

    abstract createNode(operation: CreateNodeOperation, relativeLocation?: Point): GNode | undefined;
}
