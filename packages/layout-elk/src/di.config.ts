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
import { LayoutEngine } from '@eclipse-glsp/server-node/';
import ElkConstructor, { LayoutOptions } from 'elkjs/lib/elk.bundled';
import { ContainerModule } from 'inversify';
import { ElkFactory, ElkLayoutEngine, IElementFilter, ILayoutConfigurator } from 'sprotty-elk';
import { GlspElkLayoutEngine } from '.';
import { BasicTypeMapper } from './basic-type-mapper';
import { GlspElementFilter } from './glsp-element-filter';
import { BaseElkLayoutEngine } from './glsp-elk-layout-engine';
import { FallbackGlspLayoutConfigurator, GlspLayoutConfigurator } from './glsp-layout-configurator';

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
     * The custom {@link GlspLayoutConfigurator} class that should be bound. If this option is not set
     * the {@link FallbackGlspLayoutConfigurator} is bound instead.
     */
    layoutConfigurator?: Constructor<GlspLayoutConfigurator>;
    /**
     * The custom {@link GlspElementFilter} class that should be bound. If this option is not set, the default implementation
     * is bound.
     */
    elementFilter?: Constructor<GlspElementFilter>;
}

/**
 * Utility method to create a DI module that provides all necessary bindings to use the {@link GlspElkLayoutEngine} in a node GLSP server
 * implementation. A set of configuration options is provided to enable easy customization. In most cases at least
 * the custom {@link layoutConfigurator} binding should be provided (in addition to the required `algorithms' property) via these options.
 *
 * The constructed module is not intended for standalone use cases and only works in combination with a GLSPDiagramModule.
 *
 * * The following bindings are provided:
 * - {@link BasicTypeMapper}
 * - {@link BaseElkLayoutEngine}
 * - {@link ElkLayoutEngine}
 * - {@link GlspElementFilter}
 * - {@link IElementFilter}
 * - {@link GlspLayoutConfigurator}
 * - {@link ILayoutConfigurator}
 * - {@link LayoutEngine}
 * - {@link ElkFactory}
 *
 * @param options The configuration options
 * @returns A DI module that can be loaded as additional module when configuring a diagram module for a GLSP server.
 */
export function configureELKLayoutModule(options: ElkModuleOptions): ContainerModule {
    return new ContainerModule(bind => {
        bind(BasicTypeMapper).toSelf().inSingletonScope();
        bind(BaseElkLayoutEngine)
            .toDynamicValue(context => {
                const elkFactory = context.container.get<ElkFactory>(ElkFactory);
                const elementFilter = context.container.get<IElementFilter>(IElementFilter);
                const layoutConfigurator = context.container.get<ILayoutConfigurator>(ILayoutConfigurator);
                const typeMapper = context.container.get<BasicTypeMapper>(BasicTypeMapper);
                return new BaseElkLayoutEngine(elkFactory, elementFilter, layoutConfigurator, typeMapper);
            })
            .inSingletonScope();

        bind(ElkLayoutEngine).to(BaseElkLayoutEngine);

        if (options.elementFilter) {
            bind(GlspElementFilter).to(options.elementFilter).inSingletonScope();
        } else {
            bind(GlspElementFilter).toSelf().inSingletonScope();
        }
        bind(IElementFilter).toService(GlspElementFilter);

        if (options.layoutConfigurator) {
            bind(GlspLayoutConfigurator).to(options.layoutConfigurator);
        } else {
            bind(GlspLayoutConfigurator)
                .toDynamicValue(context => {
                    const typeMapper = context.container.get<BasicTypeMapper>(BasicTypeMapper);
                    return new FallbackGlspLayoutConfigurator(typeMapper, options.algorithms, options.defaultLayoutOptions);
                })
                .inSingletonScope();
        }
        bind(ILayoutConfigurator).toService(GlspLayoutConfigurator);
        bind(LayoutEngine).to(GlspElkLayoutEngine).inSingletonScope();

        const elkFactory: ElkFactory = () =>
            new ElkConstructor({
                algorithms: options.algorithms,
                defaultLayoutOptions: options.defaultLayoutOptions
            });

        bind(ElkFactory).toConstantValue(elkFactory);
    });
}
