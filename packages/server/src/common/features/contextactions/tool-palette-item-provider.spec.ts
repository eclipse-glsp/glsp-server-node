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
import { OperationHandlerRegistry } from '../../operations/operation-handler-registry';
import * as mock from '../../test/mock-util';
import { DefaultToolPaletteItemProvider } from './tool-palette-item-provider';
import { expect } from 'chai';

describe('Test DefaultToolPaletteItemProvider', () => {
    const operationHandlerRegistry = new OperationHandlerRegistry();
    const stubANode = new mock.StubCreateNodeOperationHandler('ANode');
    const stubBNode = new mock.StubCreateNodeOperationHandler('BNode');
    const stubAEdge = new mock.StubCreateEdgeOperationHandler('AEdge');
    const stubBEdge = new mock.StubCreateEdgeOperationHandler('BEdge');
    operationHandlerRegistry.registerHandler(stubBNode);
    operationHandlerRegistry.registerHandler(stubANode);
    operationHandlerRegistry.registerHandler(stubBEdge);
    operationHandlerRegistry.registerHandler(stubAEdge);

    it('test getItems', () => {
        const toolPaletteItemProvider = new DefaultToolPaletteItemProvider();
        toolPaletteItemProvider.operationHandlerRegistry = operationHandlerRegistry;
        const items = toolPaletteItemProvider.getItems();
        expect(items).to.have.length(2);
        expect(items[0].label).to.be.equal('Nodes');
        expect(items[0].children).to.have.length(2);
        expect(items[0].children?.[0].label).to.be.equal('ANode');
        expect(items[0].children?.[1].label).to.be.equal('BNode');
        expect(items[1].label).to.be.equal('Edges');
        expect(items[1].children).to.have.length(2);
        expect(items[1].children?.[0].label).to.be.equal('AEdge');
        expect(items[1].children?.[1].label).to.be.equal('BEdge');
    });
});
