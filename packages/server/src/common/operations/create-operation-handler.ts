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
import {
    CreateEdgeOperation,
    CreateNodeOperation,
    hasArrayProp,
    hasFunctionProp,
    hasStringProp,
    MaybePromise,
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction
} from '@eclipse-glsp/protocol';
import { Command } from '../command/command';
import { OperationHandler } from './operation-handler';

/**
 * A special {@link OperationHandler} that is responsible for the handling of (a subset of) {@link CreateEdgeOperation}s. Depending on its
 * operation type the triggered actions are {@link TriggerNodeCreationAction} or {@link TriggerEdgeCreationAction}s.
 */
export interface CreateEdgeOperationHandler extends OperationHandler {
    label: string;
    elementTypeIds: string[];
    operationType: typeof CreateEdgeOperation.KIND;
    getTriggerActions(): TriggerEdgeCreationAction[];
    createCommand(operation: CreateEdgeOperation): MaybePromise<Command | undefined>;
}

export interface CreateNodeOperationHandler extends OperationHandler {
    readonly label: string;
    elementTypeIds: string[];
    operationType: typeof CreateNodeOperation.KIND;
    getTriggerActions(): TriggerNodeCreationAction[];
    createCommand(operation: CreateNodeOperation): MaybePromise<Command | undefined>;
}
/**
 * A special {@link OperationHandler} that is responsible for the handling of a node or edge creation operation. Depending on its
 * operation type the triggered actions are {@link TriggerNodeCreationAction} or {@link TriggerEdgeCreationAction}s.
 */
export type CreateOperationHandler = CreateNodeOperationHandler | CreateEdgeOperationHandler;

export type CreateOperationKind = typeof CreateNodeOperation.KIND | typeof CreateEdgeOperation.KIND;

export namespace CreateOperationHandler {
    export function is(object: unknown): object is CreateOperationHandler {
        return (
            object instanceof OperationHandler &&
            hasStringProp(object, 'operationType') &&
            hasStringProp(object, 'label') &&
            hasArrayProp(object, 'elementTypeIds') &&
            hasFunctionProp(object, 'getTriggerActions', true)
        );
    }
}
