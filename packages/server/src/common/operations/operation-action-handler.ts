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
import { Action, MaybePromise, Operation, ServerMessageAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { Command } from '../command/command';
import { CommandStack } from '../command/command-stack';
import { Operations } from '../di/service-identifiers';
import { ModelState } from '../features/model/model-state';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { GLSPServerError } from '../utils/glsp-server-error';
import { OperationHandler } from './operation-handler';
import { OperationHandlerRegistry } from './operation-handler-registry';

@injectable()
export class OperationActionHandler implements ActionHandler {
    @inject(OperationHandlerRegistry)
    protected operationHandlerRegistry: OperationHandlerRegistry;

    @inject(ModelSubmissionHandler)
    protected modelSubmissionHandler: ModelSubmissionHandler;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(CommandStack)
    protected commandStack: CommandStack;

    constructor(@inject(Operations) readonly actionKinds: string[]) {}

    execute(action: Operation): MaybePromise<Action[]> {
        if (!this.handles(action)) {
            throw new GLSPServerError(`Unhandled operation kind: ${action.kind}`);
        }
        if (this.modelState.isReadonly) {
            return [
                ServerMessageAction.create(`Server is in readonly-mode! Could not execute operation: ${action.kind}`, {
                    severity: 'WARNING'
                })
            ];
        }
        return this.executeOperation(action);
    }

    protected executeOperation(operation: Operation): MaybePromise<Action[]> {
        const operationHandler = OperationActionHandler.getOperationHandler(operation, this.operationHandlerRegistry);
        if (operationHandler) {
            return this.executeHandler(operation, operationHandler);
        }
        return [];
    }

    protected async executeHandler(operation: Operation, handler: OperationHandler): Promise<Action[]> {
        const command = await handler.execute(operation);
        if (command) {
            this.executeCommand(command);
        }
        return this.modelSubmissionHandler.submitModel('operation');
    }

    protected executeCommand(command: Command): void {
        this.commandStack.execute(command);
    }

    protected submitModel(): MaybePromise<Action[]> {
        return this.modelSubmissionHandler.submitModel('operation');
    }

    handles(action: Action): boolean {
        return this.actionKinds.includes(action.kind);
    }

    /**
     *  @Deprecated Use {@link OperationHandlerRegistry#getOperationHandler(Operation) instead}.
     */

    static getOperationHandler(operation: Operation, registry: OperationHandlerRegistry): OperationHandler | undefined {
        return registry.getOperationHandler(operation);
    }
}
