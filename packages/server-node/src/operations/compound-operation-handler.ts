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
import { CompoundOperation, MaybePromise, Operation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { OperationActionHandler } from './operation-action-handler';
import { OperationHandler } from './operation-handler';
import { OperationHandlerRegistry } from './operation-handler-registry';

@injectable()
export class CompoundOperationHandler implements OperationHandler {
    operationType = CompoundOperation.KIND;

    @inject(OperationHandlerRegistry) protected operationHandlerRegistry: OperationHandlerRegistry;

    execute(operation: CompoundOperation): void {
        operation.operationList.forEach(nestedOperation => this.executeNestedOperation(nestedOperation));
    }

    executeNestedOperation(operation: Operation): MaybePromise<void> {
        const operationHandler = OperationActionHandler.getOperationHandler(operation, this.operationHandlerRegistry);
        if (operationHandler) {
            operationHandler.execute(operation);
        }
    }
}
