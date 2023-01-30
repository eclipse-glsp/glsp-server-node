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
import { GEdge, GNode, GPort } from '@eclipse-glsp/graph';
import { MaybePromise, ReconnectEdgeOperation } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { GLSPServerError } from '../utils/glsp-server-error';
import { GModelOperationHandler } from './gmodel-operation-handler';

@injectable()
export class GModelReconnectEdgeOperationHandler extends GModelOperationHandler {
    operationType = ReconnectEdgeOperation.KIND;

    createCommand(operation: ReconnectEdgeOperation): MaybePromise<Command | undefined> {
        return this.commandOf(() => this.executeReconnect(operation));
    }

    executeReconnect(operation: ReconnectEdgeOperation): MaybePromise<void> {
        if (!operation.edgeElementId || !operation.sourceElementId || !operation.targetElementId) {
            throw new GLSPServerError('Incomplete reconnect connection action');
        }

        const index = this.modelState.index;

        const edge = index.findByClass(operation.edgeElementId, GEdge);
        const source = index.findByClass(operation.sourceElementId, GNode || GPort);
        const target = index.findByClass(operation.targetElementId, GNode || GPort);

        if (!edge) {
            throw new Error(`Invalid edge: edge ID ${operation.edgeElementId}`);
        }
        if (!source) {
            throw new Error(`Invalid source: source ID ${operation.sourceElementId}`);
        }
        if (!target) {
            throw new Error(`Invalid target: target ID ${operation.targetElementId}`);
        }

        edge.sourceId = source.id;
        edge.targetId = target.id;
        edge.routingPoints = [];
    }
}
