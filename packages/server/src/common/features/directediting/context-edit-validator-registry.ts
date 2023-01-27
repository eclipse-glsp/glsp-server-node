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
import { inject, injectable, multiInject, optional } from 'inversify';
import { ContextEditValidators } from '../../di/service-identifiers';
import { Registry } from '../../utils/registry';
import { ModelState } from '../model/model-state';
import { ContextEditValidator, ValidateLabelEditAdapter } from './context-edit-validator';
import { LabelEditValidator } from './label-edit-validator';

export const ContextEditValidatorRegistry = Symbol.for('ContextEditValidatorRegistry');

/**
 * A registry that keeps track of all registered {@link ContextEditValidator}s.
 */
export interface ContextEditValidatorRegistry extends Registry<string, ContextEditValidator> {}

@injectable()
export class DefaultContextEditValidatorRegistry extends Registry<string, ContextEditValidator> implements ContextEditValidatorRegistry {
    constructor(
        @inject(ModelState) modelState: ModelState,
        @multiInject(ContextEditValidators) @optional() contextEditValidators: ContextEditValidator[] = [],
        @inject(LabelEditValidator) @optional() labelEditValidator?: LabelEditValidator
    ) {
        super();
        contextEditValidators.forEach(provider => this.register(provider.contextId, provider));
        if (labelEditValidator) {
            this.register(LabelEditValidator.CONTEXT_ID, new ValidateLabelEditAdapter(modelState, labelEditValidator));
        }
    }
}
