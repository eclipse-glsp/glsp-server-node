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
import { GLSPClientProxy, bindOrRebind } from '@eclipse-glsp/protocol';
import { ContainerModule } from 'inversify';
import { ClientActionKinds, ClientId } from './service-identifiers';

export interface ClientSessionModuleOptions {
    clientId: string;
    glspClient: GLSPClientProxy;
    clientActionKinds: string[];
}

/**
 * Creates the DI module that binds client session specific configuration
 */
export function createClientSessionModule(options: ClientSessionModuleOptions): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };
        bindOrRebind(context, ClientId).toConstantValue(options.clientId);
        bind(GLSPClientProxy).toConstantValue(options.glspClient);
        bind(ClientActionKinds).toConstantValue(new Set(options.clientActionKinds));
    });
}
