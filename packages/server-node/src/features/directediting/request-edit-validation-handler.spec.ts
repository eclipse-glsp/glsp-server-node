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
import { GNode } from '@eclipse-glsp/graph';
import { RequestEditValidationAction, SetEditValidationResultAction, ValidationStatus } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { GModelState } from '../../base-impl/gmodel-state';
import { TestContextEditValidator, TestLabelEditValidator } from '../../test/mock-util';
import { GModelIndex } from '../model/gmodel-index';
import { ContextEditValidator } from './context-edit-validator';
import { DefaultContextEditValidatorRegistry } from './context-edit-validator-registry';
import { LabelEditValidator } from './label-edit-validator';
import { RequestEditValidationHandler } from './request-edit-validation-handler';

describe('Test RequestEditValidationHandler', () => {
    const contextEditValidators: ContextEditValidator[] = [new TestContextEditValidator()];
    const modelState = new GModelState();
    Object.defineProperty(modelState, 'index', { value: new GModelIndex() });
    sinon.stub(modelState.index, 'get').callsFake(() => new GNode());
    const contextEditValidatorsRegistry = new DefaultContextEditValidatorRegistry(
        modelState,
        contextEditValidators,
        new TestLabelEditValidator()
    );

    const requestEditValidationHandler = new RequestEditValidationHandler();
    requestEditValidationHandler['contextEditValidatorRegistry'] = contextEditValidatorsRegistry;

    it('requestContextEditValidation with ok result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: 'test', modelElementId: '', text: 'ok' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.OK);
        expect(status.message).to.be.equal('ok');
    });

    it('requestContextEditValidation with warning result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: 'test', modelElementId: '', text: 'warning' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.WARNING);
        expect(status.message).to.be.equal('warning');
    });

    it('requestContextEditValidation with error result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: 'test', modelElementId: '', text: 'error' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.ERROR);
        expect(status.message).to.be.equal('error');
    });

    it('requestLabelEditValidation with ok result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: LabelEditValidator.CONTEXT_ID, modelElementId: '', text: 'ok' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.OK);
        expect(status.message).to.be.equal('ok');
    });

    it('requestLabelEditValidation with warning result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: LabelEditValidator.CONTEXT_ID, modelElementId: '', text: 'warning' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.WARNING);
        expect(status.message).to.be.equal('warning');
    });

    it('requestLabelEditValidation with error result', async () => {
        const actions = await requestEditValidationHandler.execute(
            RequestEditValidationAction.create({ contextId: LabelEditValidator.CONTEXT_ID, modelElementId: '', text: 'error' })
        );
        expect(actions).to.have.length(1);
        const action = actions[0];

        expect(SetEditValidationResultAction.is(action)).to.be.true;
        const setEditValidationResultAction = action as SetEditValidationResultAction;
        const status = setEditValidationResultAction.status;

        expect(status.severity).to.be.equal(ValidationStatus.Severity.ERROR);
        expect(status.message).to.be.equal('error');
    });
});
