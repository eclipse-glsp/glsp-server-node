/********************************************************************************
 * Copyright (c) 2022-2026 EclipseSource and others.
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

// Side-effect import: patches Promise, timers, XHR, observers on the current realm to preserve async context across awaits.
import { AsyncLocalStorage } from 'als-browser';
import { ContainerModule } from 'inversify';
import { ActionDispatchContext, InjectionContainer, LogLevel, LoggerConfigOptions, configureConsoleLogger } from '../../common/';

export function createAppModule(options: LoggerConfigOptions = {}): ContainerModule {
    const resolvedOptions: LoggerConfigOptions = { consoleLog: true, logLevel: LogLevel.info, ...options };
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(InjectionContainer).toDynamicValue(dynamicContext => dynamicContext.container);
        bind(ActionDispatchContext).toDynamicValue(() => new AsyncLocalStorage<boolean>());
        const context = { bind, unbind, isBound, rebind };
        configureConsoleLogger(context, resolvedOptions);
    });
}
