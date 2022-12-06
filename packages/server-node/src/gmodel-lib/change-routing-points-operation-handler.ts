/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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

import { ChangeRoutingPointsOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ModelState } from '../features/model/model-state';
import { OperationHandler } from '../operations/operation-handler';
import { GLSPServerError } from '../utils/glsp-server-error';
import { applyRoutingPoints } from '../utils/layout-util';

@injectable()
export class ChangeRoutingPointsOperationHandler implements OperationHandler {
    operationType = ChangeRoutingPointsOperation.KIND;

    @inject(ModelState)
    protected modelState: ModelState;

    execute(operation: ChangeRoutingPointsOperation): void {
        if (!operation.newRoutingPoints) {
            throw new GLSPServerError('Incomplete change routingPoints  action');
        }

        const index = this.modelState.index;
        operation.newRoutingPoints.forEach(routingPoints => applyRoutingPoints(routingPoints, index));
    }
}
