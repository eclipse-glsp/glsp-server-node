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
import { ActionDispatchContext } from '../../common/actions/action-dispatcher';
import { ClientAction } from '../../common/protocol/client-action';

/**
 * Browser-compatible {@link ActionDispatchContext} that uses a simple flag instead of
 * `AsyncLocalStorage`. Currently available polyfill implementations of `AsyncLocalStorage` do not work correctly
 *  in certain browser/javascript engines (e.g. V8)
 *
 * The flag-based approach has one limitation:
 * it cannot distinguish "within the handler's async continuation" from "new event that arrived during an await gap.
 * This means, that subsequent client actions might be dispatched inline instead of being queued, if they arrive during an await gap.
 * To prevent this, we always treat client-originated actions as out-of-context, ensuring they are queued rather than dispatched inline.
 *
 * There still is a corner case for server-originated actions that are dispatched in a different async chain e.g timer-based.
 * However, in practice this means that these actions are dispatched inline instead of being queued, which does not cause any issues.
 * Since they originated from a different async chain, there were no order guarantees with respect to the current action anyway.
 */
export class BrowserDispatchContext implements ActionDispatchContext {
    protected active = false;

    run<R>(callback: () => R): R {
        const prior = this.active;
        this.active = true;
        const result = callback();
        if (result instanceof Promise) {
            return result.finally(() => {
                this.active = prior;
            }) as unknown as R;
        }
        this.active = prior;
        return result;
    }

    isInContext(action: Action): boolean {
        return this.active && !ClientAction.is(action);
    }
}
