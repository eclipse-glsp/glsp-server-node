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

import { GEdge } from '@eclipse-glsp/graph';
import { ChangeRoutingPointsOperation, ElementAndRoutingPoints, MaybePromise, Point } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { applyRoutingPoints } from '../utils/layout-util';
import { GModelOperationHandler } from './gmodel-operation-handler';

@injectable()
export class GModelChangeRoutingPointsOperationHandler extends GModelOperationHandler {
    operationType = ChangeRoutingPointsOperation.KIND;

    createCommand(operation: ChangeRoutingPointsOperation): MaybePromise<Command | undefined> {
        const newRoutingPoints = operation.newRoutingPoints.filter(newRoutingPoints => this.hasChanged(newRoutingPoints));
        if (newRoutingPoints.length === 0) {
            return undefined;
        }
        return this.commandOf(() => this.executeChangeRoutingPoints({ ...operation, newRoutingPoints }));
    }

    protected hasChanged(element: ElementAndRoutingPoints): boolean {
        const knownElement = this.modelState.index.findByClass(element.elementId, GEdge);
        if (!knownElement || knownElement.routingPoints.length !== element.newRoutingPoints?.length) {
            return true;
        }
        for (let i = 0; i < knownElement.routingPoints.length; i++) {
            if (!Point.equals(knownElement.routingPoints[i], element.newRoutingPoints[i])) {
                return true;
            }
        }
        return false;
    }

    executeChangeRoutingPoints(operation: ChangeRoutingPointsOperation): MaybePromise<void> {
        const index = this.modelState.index;
        operation.newRoutingPoints.forEach(routingPoints => applyRoutingPoints(routingPoints, index));
    }
}
