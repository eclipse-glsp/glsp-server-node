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
import { Container, ContainerModule, inject, injectable } from 'inversify';
import { ClientActionKinds, DiagramModules, InjectionContainer } from '../di/service-identifiers';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { ActionHandlerRegistry } from './action-handler-registry';
import { ClientActionHandler } from './client-action-handler';

export const GlobalActionProvider = Symbol('GlobalActionProvider');

export interface GlobalActionProvider {
    readonly serverActionKinds: Map<string, string[]>;
    readonly clientActionKinds: Map<string, string[]>;
}

@injectable()
export class DefaultGlobalActionProvider implements GlobalActionProvider {
    public readonly serverActionKinds: Map<string, string[]>;
    public readonly clientActionKinds: Map<string, string[]>;

    constructor(
        @inject(InjectionContainer) serverContainer: Container,
        @inject(DiagramModules) diagramModules: Map<string, ContainerModule[]>
    ) {
        this.serverActionKinds = new Map();
        this.clientActionKinds = new Map();
        diagramModules.forEach((modules, diagramType) => {
            const container = this.createDiagramContainer(serverContainer, modules);
            const initializers = container.getAll<ClientSessionInitializer>(ClientSessionInitializer);
            initializers.forEach(service => service.initialize());
            this.loadServerActionKinds(diagramType, container);
            this.loadClientActionKinds(diagramType, container);
            container.unbindAll();
        });
    }

    createDiagramContainer(serverContainer: Container, modules: ContainerModule[]): Container {
        const container = serverContainer.createChild();
        container.load(...modules);
        return container;
    }

    loadServerActionKinds(diagramType: string, diagramContainer: Container): void {
        const handlerRegistry = diagramContainer.get<ActionHandlerRegistry>(ActionHandlerRegistry);
        const diagramServerActions = this.serverActionKinds.get(diagramType) ?? [];
        handlerRegistry
            .getAll()
            .filter(handler => !(handler instanceof ClientActionHandler))
            .forEach(handler => diagramServerActions.push(...handler.actionKinds));
        this.serverActionKinds.set(diagramType, [...new Set(diagramServerActions)]);
    }

    loadClientActionKinds(diagramType: string, diagramContainer: Container): void {
        const clientActionKinds = diagramContainer.getAll<string>(ClientActionKinds);
        const diagramClientActions = this.clientActionKinds.get(diagramType) ?? [];
        diagramClientActions.push(...clientActionKinds);
        this.clientActionKinds.set(diagramType, diagramClientActions);
    }
}
