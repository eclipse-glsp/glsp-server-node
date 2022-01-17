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
import { GLabel } from '@eclipse-glsp/graph';
import { ApplyLabelEditOperation } from '@eclipse-glsp/protocol';
import { GModelState } from '../../base-impl/gmodel-state';
import { GModelIndex } from '../model/gmodel-index';
import { ApplyLabelEditOperationHandler } from './apply-label-edit-operation-handler';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('Test ApplyLabelEditOperationHandler', () => {
    const label = new GLabel();
    const modelState = new GModelState();
    Object.defineProperty(modelState, 'index', { value: new GModelIndex() });
    sinon.stub(modelState.index, 'findByClass').returns(label);
    const applyLabelEditOperationHandler = new ApplyLabelEditOperationHandler();
    Object.defineProperty(applyLabelEditOperationHandler, 'modelState', { value: modelState });

    it('text is changed after ApplyLabelEditOperation', async () => {
        expect(applyLabelEditOperationHandler.execute(new ApplyLabelEditOperation('undefined', 'test'))).to.not.throw;
        expect(label.text).to.be.equal('test');
    });
});
