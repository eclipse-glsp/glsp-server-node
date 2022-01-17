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
import { GModelState } from '../../base-impl/gmodel-state';
import { TestContextEditValidator, TestLabelEditValidator } from '../../test/mock-util';
import { ContextEditValidator } from './context-edit-validator';
import { DefaultContextEditValidatorRegistry } from './context-edit-validator-registry';
import { expect } from 'chai';

describe('Test DefaultContextEditValidatorRegistry', () => {
    it('check if default registry is empty', () => {
        const contextEditValidators: ContextEditValidator[] = [];
        const contextEditValidatorRegistry = new DefaultContextEditValidatorRegistry(new GModelState(), contextEditValidators);
        expect(contextEditValidatorRegistry.keys()).to.have.length(0);
    });

    it('register TestContextEditValidator via ContextEditValidators list', () => {
        const contextEditValidators: ContextEditValidator[] = [new TestContextEditValidator()];
        const contextEditValidatorsRegistry = new DefaultContextEditValidatorRegistry(new GModelState(), contextEditValidators);
        expect(contextEditValidatorsRegistry.keys()).to.have.length(1);
    });

    it('register TestLabelEditValidator via LabelEditValidator', () => {
        const contextEditValidators: ContextEditValidator[] = [];
        const contextEditValidatorsRegistry = new DefaultContextEditValidatorRegistry(
            new GModelState(),
            contextEditValidators,
            new TestLabelEditValidator()
        );
        expect(contextEditValidatorsRegistry.keys()).to.have.length(1);
    });

    it('register via ContextEditValidators list and LabelEditValidator', () => {
        const contextEditValidators: ContextEditValidator[] = [new TestContextEditValidator()];
        const contextEditValidatorsRegistry = new DefaultContextEditValidatorRegistry(
            new GModelState(),
            contextEditValidators,
            new TestLabelEditValidator()
        );
        expect(contextEditValidatorsRegistry.keys()).to.have.length(2);
    });
});
