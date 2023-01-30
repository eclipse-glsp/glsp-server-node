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

import { GEdge, GModelElement, GPort } from '@eclipse-glsp/graph';
import { GNode } from '@eclipse-glsp/graph/lib/gnode';
import { CreateEdgeOperation, MaybePromise, TriggerEdgeCreationAction } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { CreateOperationHandler, CreateOperationKind } from '../operations/create-operation-handler';
import { GModelOperationHandler } from './gmodel-operation-handler';

/**
 * An abstract base implementation of {@link CreateEdgeOperation} handlers for diagram implementations
 * where the graphical model is also directly used as source model.
 * (i.e. all operation handlers directly modify the graphical model).
 */
@injectable()
export abstract class GModelCreateEdgeOperationHandler extends GModelOperationHandler implements CreateOperationHandler {
    override readonly operationType: CreateOperationKind = CreateEdgeOperation.KIND;
    abstract override label: string;
    abstract elementTypeIds: string[];

    override createCommand(operation: CreateEdgeOperation): MaybePromise<Command | undefined> {
        return this.commandOf(() => this.executeCreation(operation));
    }

    getTriggerActions(): TriggerEdgeCreationAction[] {
        return this.elementTypeIds.map(typeId => TriggerEdgeCreationAction.create(typeId));
    }

    executeCreation(operation: CreateEdgeOperation): void {
        const index = this.modelState.index;

        const source = index.find(operation.sourceElementId, element => element instanceof GNode || element instanceof GPort);
        const target = index.find(operation.targetElementId, element => element instanceof GNode || element instanceof GPort);

        if (!source || !target) {
            throw new Error(
                `Invalid source or target for source ID ${operation.sourceElementId} and target ID ${operation.targetElementId}`
            );
        }

        const connection = this.createEdge(source, target);
        if (connection) {
            const currentModel = this.modelState.root;
            currentModel.children.push(connection);
        }
    }

    abstract createEdge(source: GModelElement, target: GModelElement): GEdge | undefined;
}
