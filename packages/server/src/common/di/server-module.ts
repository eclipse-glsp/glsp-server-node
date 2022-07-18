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
import { ContainerModule, interfaces } from 'inversify';
import { DefaultGlobalActionProvider, GlobalActionProvider } from '../actions/global-action-provider';
import { DefaultGLSPClientProxy, GLSPClientProxy, JsonRpcGLSPClientProxy } from '../protocol/glsp-client-proxy';
import { DefaultGLSPServer, GLSPServer, JsonRpcGLSPServer } from '../protocol/glsp-server';
import { GLSPServerListener } from '../protocol/glsp-server-listener';
import { ClientSessionFactory, DefaultClientSessionFactory } from '../session/client-session-factory';
import { ClientSessionManager, DefaultClientSessionManager } from '../session/client-session-manager';
import { applyBindingTarget, BindingTarget } from './binding-target';
import { DiagramModule } from './diagram-module';
import { GLSPModule } from './glsp-module';
import { MultiBinding } from './multi-binding';
import { DiagramModules, InjectionContainer } from './service-identifiers';

/**
 * The server module is the central configuration artifact for configuring the server container (i.e. main container). For
 * each application connecting to the server process a new server container is created. The server module provides the
 * base bindings necessary for setting up the base {@link GLSPServer} infrastructure. In addition, it is used to
 * configure the set of {@link DiagramModule}s. Diagram modules are used to create the diagram-session-specific child
 * container when the
 * {@link GLSPServer.initializeClientSession()}
 * method is called.
 *
 * The following bindings are provided:
 *
 * * {@link Map<String, Module>} annotated with `@named("Diagram_Modules")`
 * * {@link GLSPServer}
 * * {@link ClientSessionFactory}
 * * {@link ClientSessionManager}
 * * {@link GlobalActionProvider}
 * * {@link GLSPClientProxy}
 *
 */
export class ServerModule extends GLSPModule {
    public static DIAGRAM_MODULES = 'Diagram_Modules';
    protected readonly diagramModules: Map<string, ContainerModule[]> = new Map();

    /**
     * Configure a new {@link DiagramModule} for this server. A diagram module represents the base configuration artifact
     * for configuring a diagram-language-specific client session container. The diagram type provided
     * {@link DiagramModule.diagramType} is used to retrieve the correct diagram module when the {@link GLSPServer}
     * initializes a new client session.
     *
     * @param diagramModule The base diagram module
     * @param additionalModules Additional modules
     * @returns The server module itself. This enables a builder-pattern like chaining of multiple diagram configuration
     *         calls.
     */
    configureDiagramModule(diagramModule: DiagramModule, ...additionalModules: ContainerModule[]): ServerModule {
        const diagramType = diagramModule.diagramType;
        if (this.diagramModules.has(diagramType)) {
            throw new Error(`A module configuration is already present for diagram type: '${diagramType}'`);
        }
        this.diagramModules.set(diagramType, [diagramModule, ...additionalModules]);
        return this;
    }

    configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        const context = this.context;
        applyBindingTarget(context, DiagramModules, this.bindDiagramModules());

        applyBindingTarget(context, GLSPServer, this.bindGLSPServer()).inSingletonScope();
        applyBindingTarget(context, JsonRpcGLSPServer, this.bindJsonRpcGLSPServer());
        applyBindingTarget(context, ClientSessionFactory, this.bindClientSessionFactory()).inSingletonScope();
        applyBindingTarget(context, ClientSessionManager, this.bindClientSessionManager()).inSingletonScope();
        this.configureMultiBinding(new MultiBinding<GLSPServerListener>(GLSPServerListener), binding =>
            this.configureGLSPServerListeners(binding)
        );

        applyBindingTarget(context, GlobalActionProvider, this.bindGlobalActionProvider()).inSingletonScope();

        applyBindingTarget(context, InjectionContainer, this.bindInjectionContainer());

        applyBindingTarget(context, GLSPClientProxy, this.bindGLSPClientProxy()).inSingletonScope();
        applyBindingTarget(context, JsonRpcGLSPClientProxy, this.bindJsonRpcGLSPClientProxy());
    }

    protected bindDiagramModules(): BindingTarget<Map<string, ContainerModule[]>> {
        return { constantValue: this.diagramModules };
    }

    protected bindGLSPServer(): BindingTarget<GLSPServer> {
        return DefaultGLSPServer;
    }

    protected bindJsonRpcGLSPServer(): BindingTarget<JsonRpcGLSPServer> {
        return { service: GLSPServer };
    }

    protected bindClientSessionFactory(): BindingTarget<ClientSessionFactory> {
        return DefaultClientSessionFactory;
    }

    protected bindClientSessionManager(): BindingTarget<ClientSessionManager> {
        return DefaultClientSessionManager;
    }

    protected bindGlobalActionProvider(): BindingTarget<GlobalActionProvider> {
        return DefaultGlobalActionProvider;
    }

    protected bindInjectionContainer(): BindingTarget<interfaces.Container> {
        return { dynamicValue: context => context.container };
    }

    protected bindGLSPClientProxy(): BindingTarget<GLSPClientProxy> {
        return DefaultGLSPClientProxy;
    }

    protected bindJsonRpcGLSPClientProxy(): BindingTarget<JsonRpcGLSPClientProxy> {
        return { service: GLSPClientProxy };
    }

    protected configureGLSPServerListeners(binding: MultiBinding<GLSPServerListener>): void {
        binding.add({ service: ClientSessionManager });
    }
}
