/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
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
import { LayoutEngine, ModelState } from '@eclipse-glsp/server';
import ElkConstructor, { LayoutOptions } from 'elkjs/lib/elk.bundled';
import { ContainerModule } from 'inversify';
import { DefaultElementFilter, ElementFilter } from './element-filter';
import { ElkFactory, GlspElkLayoutEngine } from './glsp-elk-layout-engine';
import { FallbackLayoutConfigurator, LayoutConfigurator } from './layout-configurator';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Configuration options for the {@link configureELKLayoutModule} function.
 */
export interface ElkModuleOptions {
    /**
     * The set of elk algorithms that is used by the {@link GlspElkLayoutEngine}.
     */
    algorithms: string[];
    /**
     * Additional default layout options. This options are passed to the underlying {@link ElkFactory}.
     * In addition, they are used to configure the {@link FallbackGlspLayoutConfigurator}.
     */
    defaultLayoutOptions?: LayoutOptions;
    /**
     * The custom {@link LayoutConfigurator} class that should be bound. If this option is not set
     * the {@link FallbackLayoutConfigurator} is bound instead.
     */
    layoutConfigurator?: Constructor<LayoutConfigurator>;
    /**
     * The custom {@link ElementFilter} class that should be bound. If this option is not set, the default implementation
     * is bound.
     */
    elementFilter?: Constructor<ElementFilter>;
    /**
     * A flag to indicate whether a WebWorker context is provided. If this option is set, a feature is mocked that would
     * only be available in a node environment.
     */
    isWebWorker?: boolean;
}

/**
 * Utility method to create a DI module that provides all necessary bindings to use the {@link GlspElkLayoutEngine} in a node GLSP server
 * implementation. A set of configuration options is provided to enable easy customization. In most cases at least
 * the custom {@link layoutConfigurator} binding should be provided (in addition to the required `algorithms' property) via these options.
 *
 * The constructed module is not intended for standalone use cases and only works in combination with a GLSPDiagramModule.
 *
 * * The following bindings are provided:
 * - {@link ILayoutConfigurator}
 * - {@link IElementFilter}
 * - {@link LayoutEngine}
 * - {@link ElkFactory}
 *
 * @param options The configuration options
 * @returns A DI module that can be loaded as additional module when configuring a diagram module for a GLSP server.
 */
export function configureELKLayoutModule(options: ElkModuleOptions): ContainerModule {
    return new ContainerModule(bind => {
        if (options.elementFilter) {
            bind(ElementFilter).to(options.elementFilter).inSingletonScope();
        } else {
            bind(ElementFilter).to(DefaultElementFilter).inSingletonScope();
        }

        if (options.layoutConfigurator) {
            bind(LayoutConfigurator).to(options.layoutConfigurator);
        } else {
            bind(LayoutConfigurator)
                .toDynamicValue(context => new FallbackLayoutConfigurator(options.algorithms, options.defaultLayoutOptions))
                .inSingletonScope();
        }

        const elkFactory: ElkFactory = () =>
            new ElkConstructor({
                algorithms: options.algorithms,
                defaultLayoutOptions: options.defaultLayoutOptions,
                // The node implementation relied on elkjs' `FakeWorker` to set the `workerFactory`.
                // However, since the required file is dynamically loaded and not available in a web-worker context,
                // it needs to be mocked manually.
                workerFactory: options.isWebWorker ? () => ({ postMessage: () => {} }) as unknown as Worker : undefined
            });

        bind(ElkFactory).toConstantValue(elkFactory);

        bind(GlspElkLayoutEngine)
            .toDynamicValue(context => {
                const container = context.container;
                const factory = container.get<ElkFactory>(ElkFactory);
                const filter = container.get<ElementFilter>(ElementFilter);
                const configurator = container.get<LayoutConfigurator>(LayoutConfigurator);
                const modelState = container.get<ModelState>(ModelState);
                return new GlspElkLayoutEngine(factory, filter, configurator, modelState);
            })
            .inSingletonScope();
        bind(LayoutEngine).toService(GlspElkLayoutEngine);
    });
}
