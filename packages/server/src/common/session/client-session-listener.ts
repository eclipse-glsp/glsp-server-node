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
import { ClientSession } from './client-session';

/**
 * A listener that gets notified on certain client session lifecycle events.<br>
 * Life cycle events:
 * * Session creation
 * * Session disposal
 *
 * The scope of relevant client session ids can be restricted when registering the listener with
 * `ClientSessionManager.addListener()`
 */
export interface ClientSessionListener {
    /**
     * Is invoked after a new {@link ClientSession} has been created by the `ClientSessionManager`.
     *
     * @param clientSession The newly created client session.
     */
    sessionCreated?(clientSession: ClientSession): void;

    /**
     * Is invoked after a {@link ClientSession} has been disposed by the `ClientSessionManager`.
     *
     * @param clientSession The client session that was disposed.
     */
    sessionDisposed?(clientSession: ClientSession): void;
}
