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
import { Action, isCreateOperation, MaybePromise, Operation, ServerMessageAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { GModelState } from '../base-impl/gmodel-state';
import { Operations } from '../di/service-identifiers';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { OperationHandler } from './operation-handler';
import { OperationHandlerRegistry } from './operation-handler-registry';

@injectable()
export class OperationActionHandler implements ActionHandler {
    @inject(OperationHandlerRegistry) protected operationHandlerRegistry: OperationHandlerRegistry;
    @inject(ModelSubmissionHandler) protected modelSubmissionHandler: ModelSubmissionHandler;
    @inject(GModelState) protected modelState: GModelState;

    constructor(@inject(Operations) readonly actionKinds: string[]) {}

    execute(action: Action): MaybePromise<Action[]> {
        if (this.handles(action)) {
            if (this.modelState.isReadonly) {
                return [new ServerMessageAction('WARNING', `Server is in readonly-mode! Could not execute operation: ${action.kind}`)];
            }
            const operationHandler = OperationActionHandler.getOperationHandler(action, this.operationHandlerRegistry);
            if (operationHandler) {
                return this.executeHandler(action, operationHandler);
            }
        }
        return [];
    }

    async executeHandler(operation: Operation, handler: OperationHandler): Promise<Action[]> {
        // TODO: Create GModelRecordingCommand;
        await handler.execute(operation);
        this.modelState.index.indexRoot(this.modelState.root);
        // TODO: this.modelState.execute(command)
        return this.modelSubmissionHandler.submitModel(); // TODO: Add SetDirtyStateAction.Reason.Operation
    }

    handles(action: Action): boolean {
        if (this.actionKinds.includes(action.kind)) {
            return true;
        }
        return false;
    }

    static getOperationHandler(operation: Operation, registry: OperationHandlerRegistry): OperationHandler | undefined {
        return isCreateOperation(operation) ? registry.get(`${operation.kind}_${operation.elementTypeId}`) : registry.get(operation.kind);
    }
}
