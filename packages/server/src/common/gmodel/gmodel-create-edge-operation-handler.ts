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
import { CreateEdgeOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ModelState } from '../features/model/model-state';
import { CreateOperationHandler } from '../operations/create-operation-handler';

/**
 * An abstract base implementation of {@link CreateEdgeOperation} handlers for diagram implementations
 * where the graphical model is also directly used as source model.
 * (i.e. all operation handlers directly modify the graphical model).
 */
@injectable()
export abstract class GModelCreateEdgeOperationHandler extends CreateOperationHandler {
    @inject(ModelState)
    protected modelState: ModelState;

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

        const connection = this.createEdge(source, target);
        if (connection) {
            const currentModel = this.modelState.root;
            currentModel.children.push(connection);
        }
    }

    abstract createEdge(source: GModelElement, target: GModelElement): GEdge | undefined;
}
