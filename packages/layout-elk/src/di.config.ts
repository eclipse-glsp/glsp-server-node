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
import {
    BindingTarget,
    GLSPModule,
    LayoutEngine,
    Logger,
    LoggerFactory,
    ModelState,
    NullLogger,
    applyBindingTarget
} from '@eclipse-glsp/server';
import ElkConstructor, { LayoutOptions } from 'elkjs/lib/elk.bundled';
import { ContainerModule, injectable, interfaces } from 'inversify';
import { DefaultElementFilter, ElementFilter } from './element-filter';
import { ElkFactory, GlspElkLayoutEngine } from './glsp-elk-layout-engine';
import { FallbackLayoutConfigurator, LayoutConfigurator } from './layout-configurator';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Configuration options for the {@link ElkLayoutModule} (and the legacy {@link configureELKLayoutModule} factory).
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
 * DI module that provides the bindings needed to use the {@link GlspElkLayoutEngine} in a node GLSP server.
 *
 * Subclass and override the `bindXxx()` hooks to customize individual bindings — e.g. to swap the
 * layout configurator or element filter without re-implementing the whole module. The module is
 * only meaningful in combination with a `GLSPDiagramModule`.
 *
 * Bindings provided:
 * - {@link ElementFilter}
 * - {@link LayoutConfigurator}
 * - {@link ElkFactory}
 * - {@link GlspElkLayoutEngine} + {@link LayoutEngine} (toService)
 * - Fallback bindings for {@link Logger} and {@link LoggerFactory} if absent.
 */
@injectable()
export class ElkLayoutModule extends GLSPModule {
    constructor(protected readonly options: ElkModuleOptions) {
        super();
    }

    protected configure(bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind): void {
        const context = { bind, unbind, isBound, rebind };
        applyBindingTarget(context, ElementFilter, this.bindElementFilter()).inSingletonScope();
        applyBindingTarget(context, LayoutConfigurator, this.bindLayoutConfigurator()).inSingletonScope();
        applyBindingTarget(context, ElkFactory, this.bindElkFactory());
        applyBindingTarget(context, GlspElkLayoutEngine, this.bindGlspElkLayoutEngine()).inSingletonScope();
        bind(LayoutEngine).toService(GlspElkLayoutEngine);
        this.bindLoggerFallbacks(bind, isBound);
    }

    protected bindElementFilter(): BindingTarget<ElementFilter> {
        return this.options.elementFilter ?? DefaultElementFilter;
    }

    protected bindLayoutConfigurator(): BindingTarget<LayoutConfigurator> {
        if (this.options.layoutConfigurator) {
            return this.options.layoutConfigurator;
        }
        return { dynamicValue: () => new FallbackLayoutConfigurator(this.options.algorithms, this.options.defaultLayoutOptions) };
    }

    protected bindElkFactory(): BindingTarget<ElkFactory> {
        const { algorithms, defaultLayoutOptions, isWebWorker } = this.options;
        const factory: ElkFactory = () =>
            new ElkConstructor({
                algorithms,
                defaultLayoutOptions,
                // The node implementation relies on elkjs' `FakeWorker` to set the `workerFactory`. The required file is
                // dynamically loaded and not available in a web-worker context, so it has to be mocked manually there.
                workerFactory: isWebWorker ? () => ({ postMessage: () => {} }) as unknown as Worker : undefined
            });
        return { constantValue: factory };
    }

    protected bindGlspElkLayoutEngine(): BindingTarget<GlspElkLayoutEngine> {
        return {
            dynamicValue: ctx => {
                const factory = ctx.container.get<ElkFactory>(ElkFactory);
                const filter = ctx.container.get<ElementFilter>(ElementFilter);
                const configurator = ctx.container.get<LayoutConfigurator>(LayoutConfigurator);
                const modelState = ctx.container.get<ModelState>(ModelState);
                return new GlspElkLayoutEngine(factory, filter, configurator, modelState);
            }
        };
    }

    /** Provide fallbacks so the module works standalone in tests/specs that don't preconfigure logging. */
    protected bindLoggerFallbacks(bind: interfaces.Bind, isBound: interfaces.IsBound): void {
        if (!isBound(Logger)) {
            bind(Logger).to(NullLogger).inSingletonScope();
        }
        if (!isBound(LoggerFactory)) {
            bind(LoggerFactory).toFactory(dynamicContext => (caller: string) => {
                const logger = dynamicContext.container.get(Logger);
                logger.caller = caller;
                return logger;
            });
        }
    }
}

/**
 * Utility wrapper around {@link ElkLayoutModule} for the common case where no override is needed.
 * Prefer subclassing {@link ElkLayoutModule} when individual bindings need to be customized.
 */
export function configureELKLayoutModule(options: ElkModuleOptions): ContainerModule {
    return new ElkLayoutModule(options);
}
