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
import { injectable } from 'inversify';
import { ActionDispatchScope } from '../../common/actions/action-dispatcher';
import { ClientAction } from '../../common/protocol/client-action';

/**
 * Browser-compatible {@link ActionDispatchScope} backed by a single boolean flag, used because
 * available `AsyncLocalStorage` polyfills do not work reliably across browser engines (e.g. V8).
 *
 * The flag cannot distinguish "still inside the handler's async continuation" from "unrelated
 * event fired during the handler's await". Any dispatch arriving in such a gap is observed as
 * reentrant and routed inline. Client-originated actions are explicitly treated as non-reentrant
 * to cover the dominant case, but server-side dispatches from non-handler contexts (timer
 * callbacks, event listeners, adopter code) cannot be filtered this way and may interleave with
 * the in-flight handler.
 *
 * The dispatcher normally serializes handler execution; the inline interleaving breaks that
 * guarantee. A handler that pauses on `await` may resume to find that another handler has mutated
 * state in between (model state, command stack, caches), leading to unexpected behavior.
 * Avoid dispatching from non-handler contexts where possible.
 */
@injectable()
export class BrowserActionDispatchScope implements ActionDispatchScope {
    protected active = false;

    // Assumes serial invocation by the dispatcher's queue processor; concurrent enter() calls
    // would corrupt the prior-restore logic and leave the flag stuck.
    enter<R>(callback: () => R): R {
        const prior = this.active;
        this.active = true;
        let result: R;
        try {
            result = callback();
        } catch (error) {
            this.active = prior;
            throw error;
        }
        if (result instanceof Promise) {
            // Cast required because TS cannot prove the .finally() result matches the generic R.
            return result.finally(() => {
                this.active = prior;
            }) as unknown as R;
        }
        this.active = prior;
        return result;
    }

    isReentrant(action: Action): boolean {
        return this.active && !ClientAction.is(action);
    }
}
