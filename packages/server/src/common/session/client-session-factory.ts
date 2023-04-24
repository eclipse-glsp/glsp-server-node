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
import { GLSPClientProxy, InitializeClientSessionParameters } from '@eclipse-glsp/protocol';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import { ActionDispatcher } from '..';
import { createClientSessionModule } from '../di/client-session-module';
import { DiagramModules, InjectionContainer } from '../di/service-identifiers';
import { GLSPServerError } from '../utils/glsp-server-error';
import { ClientSession, DefaultClientSession } from './client-session';
import { ClientSessionInitializer } from './client-session-initializer';

export const ClientSessionFactory = Symbol('ClientSessionFactory');

/**
 * Handles the construction of new {@link ClientSession}. A client session factory has to know
 * how to derive the client session specific injector and its entrypoint (i.e. the {@link ActionDispatcher}
 * from a given client session id and a given diagram type.
 */
export interface ClientSessionFactory {
    /**
     * Create a new {@link ClientSession} based on the given client session id and diagram type.
     *
     * @param clientSessionId The client session id.
     * @param diagramType     The diagram type.
     * @returns A new instance of {@link ClientSession} that correlates to the given input parameters.
     */
    create(params: InitializeClientSessionParameters): ClientSession;
}

@injectable()
export class DefaultClientSessionFactory implements ClientSessionFactory {
    @inject(InjectionContainer)
    protected serverContainer: Container;

    @inject(DiagramModules)
    protected diagramModules: Map<string, ContainerModule[]>;

    @inject(GLSPClientProxy)
    protected glspClient: GLSPClientProxy;

    create(params: InitializeClientSessionParameters): ClientSession {
        const { clientSessionId: id, diagramType, args } = params;
        const diagramModules = this.diagramModules.get(diagramType);
        if (!diagramModules || diagramModules.length === 0) {
            throw new GLSPServerError(`Could not retrieve diagram module configuration for diagram type: '${diagramType}''`);
        }

        const sessionModule = createClientSessionModule(id, this.glspClient);
        const sessionContainer = this.serverContainer.createChild();
        sessionContainer.load(...diagramModules, sessionModule);
        const initializers = sessionContainer.getAll<ClientSessionInitializer>(ClientSessionInitializer);
        initializers.forEach(service => service.initialize(args));
        const actionDispatcher = sessionContainer.get<ActionDispatcher>(ActionDispatcher);
        return new DefaultClientSession(id, diagramType, actionDispatcher, sessionContainer);
    }
}
