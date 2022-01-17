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
import { Action, ActionMessage } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ClientActionKinds, ClientId } from '../di/service-identifiers';
import { GLSPClientProxy } from '../protocol/glsp-client-proxy';

/**
 * The client action handler is responsible of handling action kinds that are intended for the
 * GLSP client, by sending them to the client over json-rpc.
 */

@injectable()
export class ClientActionHandler implements ClientActionHandler {
    @inject(GLSPClientProxy)
    @optional()
    protected glspClient?: GLSPClientProxy;

    @inject(ClientId)
    protected readonly clientId: string;

    constructor(@inject(ClientActionKinds) @optional() public actionKinds: string[] = []) {}

    execute(action: Action): [] {
        this.send(action);
        return [];
    }

    protected send(action: Action): void {
        const message: ActionMessage = { action, clientId: this.clientId };
        if (this.glspClient) {
            this.glspClient.process(message);
            return;
        }
        throw new Error('Could not send message to client. No GLSPClientProxy is defined');
    }
}
