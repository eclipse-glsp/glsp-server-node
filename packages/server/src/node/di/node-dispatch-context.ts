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

import { AsyncLocalStorage } from 'async_hooks';
import { ActionDispatchContext } from '../../common/actions/action-dispatcher';

/**
 * Node.js {@link ActionDispatchContext} backed by native `AsyncLocalStorage`.
 */
export class NodeDispatchContext implements ActionDispatchContext {
    protected storage = new AsyncLocalStorage<boolean>();

    run<R>(callback: () => R): R {
        return this.storage.run(true, callback);
    }

    isInContext(): boolean {
        return this.storage.getStore() === true;
    }
}
