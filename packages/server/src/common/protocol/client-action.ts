/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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

/**
 * A helper interface that allows the server to mark actions that have been received from the client.
 */
export interface ClientAction extends Action {
    __receivedFromClient: true;
}

export namespace ClientAction {
    export function is(object: unknown): object is ClientAction {
        return Action.is(object) && '__receivedFromClient' in object && object.__receivedFromClient === true;
    }

    /**
     * Mark the given action as {@link ClientAction} by attaching the "__receivedFromClient" property
     * @param action The action that should be marked as client action
     */
    export function mark(action: Action): void {
        (action as ClientAction).__receivedFromClient = true;
    }
}
