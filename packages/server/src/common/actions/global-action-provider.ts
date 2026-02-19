/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
import { distinctAdd } from '@eclipse-glsp/protocol';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import { createClientSessionModule } from '../di/client-session-module';
import { DiagramModules, InjectionContainer } from '../di/service-identifiers';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { ActionHandlerRegistry } from './action-handler-registry';

export const GlobalActionProvider = Symbol('GlobalActionProvider');

/**
 * Provides a map of handled action kinds grouped by `diagramType`
 */
export interface GlobalActionProvider {
    readonly actionKinds: Map<string, string[]>;
}

@injectable()
export class DefaultGlobalActionProvider implements GlobalActionProvider {
    public readonly actionKinds: Map<string, string[]>;

    constructor(
        @inject(InjectionContainer) serverContainer: Container,
        @inject(DiagramModules) diagramModules: Map<string, ContainerModule[]>
    ) {
        this.actionKinds = new Map();
        diagramModules.forEach((modules, diagramType) => {
            const container = this.createDiagramContainer(serverContainer, modules);
            const initializers = container.getAll<ClientSessionInitializer>(ClientSessionInitializer);
            initializers.forEach(service => service.initialize());
            this.loadActionKinds(diagramType, container);
            container.unbindAll();
        });
    }

    createDiagramContainer(serverContainer: Container, modules: ContainerModule[]): Container {
        const container = serverContainer.createChild();
        const clientSessionModule = createClientSessionModule({
            clientId: 'tempId',

            glspClient: { process: () => {} },
            clientActionKinds: []
        });
        container.load(...modules, clientSessionModule);
        return container;
    }

    loadActionKinds(diagramType: string, diagramContainer: Container): void {
        const handlerRegistry = diagramContainer.get<ActionHandlerRegistry>(ActionHandlerRegistry);
        const diagramServerActions = this.actionKinds.get(diagramType) ?? [];
        handlerRegistry.getAll().forEach(handler => distinctAdd(diagramServerActions, ...handler.actionKinds));
        this.actionKinds.set(diagramType, diagramServerActions);
    }
}
