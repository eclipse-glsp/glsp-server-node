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
import { Action, MaybePromise, RequestEditValidationAction, SetEditValidationResultAction, ValidationStatus } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { ContextEditValidatorRegistry } from '../../features/directediting/context-edit-validator-registry';
import { Logger } from '../../utils/logger';

@injectable()
export class RequestEditValidationHandler implements ActionHandler {
    actionKinds = [RequestEditValidationAction.KIND];

    @inject(Logger)
    protected logger: Logger;

    @inject(ContextEditValidatorRegistry)
    contextEditValidatorRegistry: ContextEditValidatorRegistry;

    execute(action: RequestEditValidationAction): MaybePromise<Action[]> {
        const validator = this.contextEditValidatorRegistry.get(action.contextId);
        if (validator) {
            const validationStatus = validator.validate(action);
            return [SetEditValidationResultAction.create(validationStatus)];
        } else {
            const message = `No validator registered for the context '${action.contextId}'`;
            this.logger.warn(message);
            return [SetEditValidationResultAction.create({ severity: ValidationStatus.Severity.WARNING, message: message })];
        }
    }
}
