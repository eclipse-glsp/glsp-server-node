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
import { Disposable } from '@eclipse-glsp/protocol';
import { Container } from 'inversify';
import { ActionDispatcher } from '../actions/action-dispatcher';

/**
 * Stores the core information that the `GLSPServer` needs to know about a client session.
 * When handling session specific requests (i.e. `ActionMessage`s the server retrieves the corresponding
 * client session from the `ClientSessionManager` and delegates the action message to its
 * {@link ActionDispatcher};
 */
export interface ClientSession extends Disposable {
    /**
     * The id of the client session.
     */
    readonly id: string;

    /**
     * The diagram type of the client session.
     */
    readonly diagramType: string;

    /**
     * The action dispatcher of this diagram type. The action dispatcher is typically created by the session
     * specific injector and is basically the entrypoint to the session specific injection context.
     */
    readonly actionDispatcher: ActionDispatcher;

    /**
     * The session specific {@link Container}.
     */
    readonly container: Container;
}

export class DefaultClientSession implements ClientSession {
    constructor(
        readonly id: string,
        readonly diagramType: string,
        readonly actionDispatcher: ActionDispatcher,
        readonly container: Container
    ) {}

    dispose(): void {
        if (Disposable.is(this.actionDispatcher)) {
            this.actionDispatcher.dispose();
        }
    }
}
