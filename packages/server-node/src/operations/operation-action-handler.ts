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
import { Action, CreateOperation, MaybePromise, Operation, ServerMessageAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { Operations } from '../di/service-identifiers';
import { ModelState } from '../features/model/model-state';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { Command } from '../features/undo-redo/command';
import { CommandStack } from '../features/undo-redo/command-stack';
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
        if (this.handles(action)) {
            if (this.modelState.isReadonly) {
                return [
                    ServerMessageAction.create(`Server is in readonly-mode! Could not execute operation: ${action.kind}`, {
                        severity: 'WARNING'
                    })
                ];
            }
            const operationHandler = OperationActionHandler.getOperationHandler(action, this.operationHandlerRegistry);
            if (operationHandler) {
                return this.executeHandler(action, operationHandler);
            }
        }
        return [];
    }

    async executeHandler(operation: Operation, handler: OperationHandler): Promise<Action[]> {
        const command = this.createCommand?.(operation, handler) ?? this.createFallbackCommand(operation, handler);
        this.commandStack.execute(command);
        return this.modelSubmissionHandler.submitModel('operation');
    }

    /**
     * Derives a {@link Command} for the given operation and handler. If not implemented fallback commands
     * will be used which do not support undo/redo.
     */
    protected createCommand?(operation: Operation, handler: OperationHandler): Command;

    protected createFallbackCommand(operation: Operation, handler: OperationHandler): Command {
        return {
            execute: () => handler.execute(operation),
            redo: noOpVoid,
            undo: noOpVoid,
            canUndo: () => false
        };
    }

    handles(action: Action): boolean {
        if (this.actionKinds.includes(action.kind)) {
            return true;
        }
        return false;
    }

    static getOperationHandler(operation: Operation, registry: OperationHandlerRegistry): OperationHandler | undefined {
        return CreateOperation.is(operation) ? registry.get(`${operation.kind}_${operation.elementTypeId}`) : registry.get(operation.kind);
    }
}

const noOpVoid: () => void = () => {
    /** no-op */
};
