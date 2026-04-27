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

import { ContainerModule } from 'inversify';
import { ActionDispatchScope, InjectionContainer, LogLevel, LoggerConfigOptions, configureConsoleLogger } from '../../common/';
import { BrowserActionDispatchScope } from './browser-action-dispatch-scope';

export function createAppModule(options: LoggerConfigOptions = {}): ContainerModule {
    const resolvedOptions: LoggerConfigOptions = { consoleLog: true, logLevel: LogLevel.info, ...options };
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(InjectionContainer).toDynamicValue(dynamicContext => dynamicContext.container);
        // Transient on purpose: a singleton at the server-container level would be shared across
        // sessions and leak the browser flag between them.
        bind(ActionDispatchScope).to(BrowserActionDispatchScope);
        const context = { bind, unbind, isBound, rebind };
        configureConsoleLogger(context, resolvedOptions);
    });
}
