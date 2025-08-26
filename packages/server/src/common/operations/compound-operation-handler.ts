/********************************************************************************
 * Copyright (c) 2022-2025 STMicroelectronics and others.
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
import { CompoundOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { Command, CompoundCommand } from '../command/command';
import { OperationHandler } from './operation-handler';
import { OperationHandlerRegistry } from './operation-handler-registry';

/**
 * Generic {@link OperationHandler} from {@link CompoundOperations}.
 * Retrieves the corresponding execution commands for the list of (sub) operations
 * and constructs a {@link CompoundCommand} for them.
 */
@injectable()
export class CompoundOperationHandler extends OperationHandler {
    @inject(OperationHandlerRegistry)
    protected operationHandlerRegistry: OperationHandlerRegistry;

    operationType = CompoundOperation.KIND;

    async createCommand(operation: CompoundOperation): Promise<Command | undefined> {
        const maybeCommands = operation.operationList.map(op => this.operationHandlerRegistry.getOperationHandler(op)?.execute(op));
        const commands: Command[] = [];

        for await (const command of maybeCommands) {
            if (command) {
                commands.push(command);
            }
        }
        return commands.length > 0 ? new CompoundCommand(commands) : undefined;
    }
}
