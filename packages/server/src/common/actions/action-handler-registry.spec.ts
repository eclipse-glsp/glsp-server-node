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
import * as mock from '../test/mock-util';
import { ActionHandlerRegistry } from './action-handler-registry';
import { expect } from 'chai';

describe('Test ActionHandlerRegistry (only functionality that is not covered by "registry.spec.ts"', () => {
    const singleAction = 'singleHandledAction';
    const multiAction = 'multiHandledAction';

    const h1 = new mock.StubActionHandler([singleAction]);
    const h2 = new mock.StubActionHandler([multiAction]);
    const h3 = new mock.StubActionHandler([multiAction]);
    const h4 = new mock.StubActionHandler([multiAction]);
    const registry: ActionHandlerRegistry = new ActionHandlerRegistry();

    it('registerHandler - should register given handlers', () => {
        // setup
        registry.registerHandler(h1);
        registry.registerHandler(h2);
        registry.registerHandler(h3);
        registry.registerHandler(h4);

        const result = registry.getAll();
        expect(result).to.have.length(4);
        expect(result.includes(h1)).true;
        expect(result.includes(h2)).true;
        expect(result.includes(h3)).true;
        expect(result.includes(h4)).true;
    });

    it('get - should return three handlers sorted by priority', () => {
        const result = registry.get(multiAction);
        expect(result.length).to.be.equal(3);
        expect(result[0]).to.be.deep.equal(h4);
        expect(result[1]).to.be.deep.equal(h2);
        expect(result[2]).to.be.deep.equal(h3);
    });
});
