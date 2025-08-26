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
import { LayoutOperation, MaybePromise } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { Command } from '../../command/command';
import { GModelRecordingCommand } from '../../command/recording-command';
import { DiagramConfiguration, ServerLayoutKind } from '../../diagram/diagram-configuration';
import { OperationHandler } from '../../operations/operation-handler';
import { Logger } from '../../utils/logger';
import { GModelSerializer } from '../model/gmodel-serializer';
import { LayoutEngine } from './layout-engine';

/**
 * The default handler for `{@link LayoutOperation}s. Does invoke the (optional) layout engine
 * if the server is configured for manual layouting. Changes are stored transient in the graphical model and are not
 * persisted in the source model.
 */
@injectable()
export class LayoutOperationHandler extends OperationHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(LayoutEngine)
    @optional()
    protected layoutEngine?: LayoutEngine;

    @inject(DiagramConfiguration)
    protected diagramConfiguration: DiagramConfiguration;

    @inject(GModelSerializer)
    protected serializer: GModelSerializer;

    readonly operationType = LayoutOperation.KIND;

    createCommand(operation: LayoutOperation): MaybePromise<Command | undefined> {
        if (this.diagramConfiguration.layoutKind !== ServerLayoutKind.MANUAL) {
            return undefined;
        }
        if (!this.layoutEngine) {
            this.logger.warn('Could not execute layout operation. No `LayoutEngine` is bound!');
            return undefined;
        }
        return new GModelRecordingCommand(this.modelState, this.serializer, () => this.executeOperation(operation));
    }

    protected async executeOperation(operation: LayoutOperation): Promise<void> {
        await this.layoutEngine?.layout(operation);
    }
}
