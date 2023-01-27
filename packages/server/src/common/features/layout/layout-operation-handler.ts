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
import { LayoutOperation, Operation } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { DiagramConfiguration, ServerLayoutKind } from '../../diagram/diagram-configuration';
import { OperationHandler } from '../../operations/operation-handler';
import { Logger } from '../../utils/logger';
import { LayoutEngine } from './layout-engine';

@injectable()
export class LayoutOperationHandler implements OperationHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(LayoutEngine)
    @optional()
    protected layoutEngine?: LayoutEngine;

    @inject(DiagramConfiguration)
    protected diagramConfiguration: DiagramConfiguration;

    readonly operationType = LayoutOperation.KIND;
    async execute(operation: Operation): Promise<void> {
        if (operation.kind === LayoutOperation.KIND) {
            if (this.diagramConfiguration.layoutKind === ServerLayoutKind.MANUAL) {
                if (this.layoutEngine) {
                    await this.layoutEngine.layout();
                    return;
                }
                this.logger.warn('Could not execute layout operation. No `LayoutEngine` is bound!');
            }
        }
    }
}
