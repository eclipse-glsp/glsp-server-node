/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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
import { InjectionContainer, Logger, LoggerFactory, LogLevel, ModuleContext, NullLogger } from '../../common/index';
import { ConsoleLogger } from './console-logger';

export interface LaunchOptions {
    consoleLog?: boolean;
    logLevel?: LogLevel;
}
export function createAppModule(options: LaunchOptions = {}): ContainerModule {
    const resolvedOptions: LaunchOptions = { consoleLog: true, logLevel: LogLevel.info, ...options };
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(InjectionContainer).toDynamicValue(dynamicContext => dynamicContext.container);
        const context = { bind, unbind, isBound, rebind };
        configureConsoleLogger(context, resolvedOptions);
    });
}

export function configureConsoleLogger<T extends LaunchOptions>(context: ModuleContext, options: T): void {
    if (!options.consoleLog) {
        context.bind(Logger).to(NullLogger).inSingletonScope();
    } else {
        context.bind(Logger).toDynamicValue(ctx => new ConsoleLogger(options.logLevel, getRequestParentName(ctx)));
    }
    context.bind(LoggerFactory).toFactory(dynamicContext => (caller: string) => {
        const logger = dynamicContext.container.get(Logger);
        logger.caller = caller;
        return logger;
    });
}

function getRequestParentName(context: interfaces.Context): string | undefined {
    if (context.currentRequest.parentRequest) {
        const bindings = context.currentRequest.parentRequest.bindings;
        if (bindings.length > 0) {
            return bindings[0].implementationType?.name;
        }
    }
    return undefined;
}
