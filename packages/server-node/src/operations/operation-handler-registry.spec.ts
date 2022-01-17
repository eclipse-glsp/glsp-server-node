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
import { CompoundOperation, CreateEdgeOperation, CreateNodeOperation } from '@eclipse-glsp/protocol';
import * as mock from '../test/mock-util';
import { CompoundOperationHandler } from './compound-operation-handler';
import { OperationHandlerRegistry } from './operation-handler-registry';
import { expect } from 'chai';

describe('Test OperationHandlerRegistry', () => {
    const stubANode = new mock.StubCreateNodeOperationHandler('ANode');
    const stubBNode = new mock.StubCreateNodeOperationHandler('BNode');
    const stubAEdge = new mock.StubCreateEdgeOperationHandler('AEdge');
    const stubBEdge = new mock.StubCreateEdgeOperationHandler('BEdge');
    const operationHandlerRegistry = new OperationHandlerRegistry();

    it('register OperationActionHandler', () => {
        operationHandlerRegistry.registerHandler(new CompoundOperationHandler());
        expect(operationHandlerRegistry.keys()).to.have.length(1);
        expect(operationHandlerRegistry.keys()).to.contain(CompoundOperation.KIND);
        expect(operationHandlerRegistry.get(CompoundOperation.KIND)).instanceOf(CompoundOperationHandler);
    });

    it('register CreateOperationActionHandlers', () => {
        operationHandlerRegistry.registerHandler(stubANode);
        operationHandlerRegistry.registerHandler(stubBNode);
        operationHandlerRegistry.registerHandler(stubAEdge);
        operationHandlerRegistry.registerHandler(stubBEdge);
        expect(operationHandlerRegistry.keys()).to.contain(`${CreateNodeOperation.KIND}_ANode`);
        expect(operationHandlerRegistry.get(`${CreateNodeOperation.KIND}_ANode`)).to.be.equal(stubANode);
        expect(operationHandlerRegistry.keys()).to.contain(`${CreateNodeOperation.KIND}_BNode`);
        expect(operationHandlerRegistry.get(`${CreateNodeOperation.KIND}_BNode`)).to.be.equal(stubBNode);
        expect(operationHandlerRegistry.keys()).to.contain(`${CreateEdgeOperation.KIND}_AEdge`);
        expect(operationHandlerRegistry.get(`${CreateEdgeOperation.KIND}_AEdge`)).to.be.equal(stubAEdge);
        expect(operationHandlerRegistry.keys()).to.contain(`${CreateEdgeOperation.KIND}_BEdge`);
        expect(operationHandlerRegistry.get(`${CreateEdgeOperation.KIND}_BEdge`)).to.be.equal(stubBEdge);
    });
});
