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
import { Action, ActionMessage, GLSPClientProxy, ResponseAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ClientActionKinds, ClientId } from '../di/service-identifiers';
import { ClientAction } from '../protocol/client-action';

/**
 * Component responsible for forwarding actions that are (also) handled by the
 * client
 */
@injectable()
export class ClientActionForwarder {
    @inject(GLSPClientProxy)
    protected glspClient: GLSPClientProxy;

    @inject(ClientId)
    protected readonly clientId: string;

    constructor(@inject(ClientActionKinds) public actionKinds: Set<string>) {}

    /**
     * Processes the given action and checks wether it is a
     * `clientAction` i.e. an action that should be forwarded to
     * the client to be handled there. If the check is successful
     * the action is wrapped in an {@link ActionMessage} and sent to the client.
     *
     * @param action The action to check and forward
     * @return `true` if the action was forwarded to the client, `false` otherwise
     */
    handle(action: Action): boolean {
        if (this.shouldForwardToClient(action)) {
            const message: ActionMessage = { action, clientId: this.clientId };
            this.glspClient.process(message);
            return true;
        }
        return false;
    }

    shouldForwardToClient(action: Action): boolean {
        if (ClientAction.is(action)) {
            return false;
        }
        return this.actionKinds.has(action.kind) || ResponseAction.is(action);
    }
}
