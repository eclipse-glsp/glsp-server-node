/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import { Action } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { ClientAction } from '../../common/protocol/client-action';
import * as mock from '../../common/test/mock-util';
import { BrowserActionDispatchScope } from './browser-action-dispatch-scope';

describe('BrowserActionDispatchScope', () => {
    const action: Action = { kind: 'foo' };
    const markedClientAction = ((): Action => {
        const a: Action = { kind: 'bar' };
        ClientAction.mark(a);
        return a;
    })();

    let scope: BrowserActionDispatchScope;
    beforeEach(() => {
        scope = new BrowserActionDispatchScope();
    });

    it('isReentrant is false outside enter()', () => {
        expect(scope.isReentrant(action)).to.be.false;
    });

    it('isReentrant is true during a synchronous enter()', () => {
        scope.enter(() => {
            expect(scope.isReentrant(action)).to.be.true;
        });
        expect(scope.isReentrant(action)).to.be.false;
    });

    it('isReentrant is true during an async enter() and false after settle', async () => {
        const probe: Promise<boolean> = scope.enter(async () => {
            await Promise.resolve();
            return scope.isReentrant(action);
        });
        expect(await probe).to.be.true;
        expect(scope.isReentrant(action)).to.be.false;
    });

    it('resets active flag when callback throws synchronously', () => {
        expect(() =>
            scope.enter(() => {
                throw new Error('boom');
            })
        ).to.throw('boom');
        expect(scope.isReentrant(action)).to.be.false;
    });

    it('resets active flag when async callback rejects', async () => {
        await mock.expectToThrowAsync(() => scope.enter(() => Promise.reject(new Error('boom'))), 'boom');
        expect(scope.isReentrant(action)).to.be.false;
    });

    it('isReentrant is false for client-originated actions even when scope is active', () => {
        scope.enter(() => {
            expect(scope.isReentrant(markedClientAction)).to.be.false;
            expect(scope.isReentrant(action)).to.be.true;
        });
    });
});
