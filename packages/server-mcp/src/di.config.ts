/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
import { GLSPServerInitContribution, GLSPServerListener } from '@eclipse-glsp/server';
import { ContainerModule } from 'inversify';
import { configureMcpResourceModule } from './resources';
import { McpServerManager } from './server';
import { configureMcpToolModule } from './tools';

// TODO possibly instead of wholly separate modules, just provide functions using bind context from tools/resources
export function configureMcpModules(): ContainerModule[] {
    return [configureMcpServerModule(), configureMcpResourceModule(), configureMcpToolModule()];
}

function configureMcpServerModule(): ContainerModule {
    return new ContainerModule(bind => {
        bind(McpServerManager).toSelf().inSingletonScope();
        bind(GLSPServerInitContribution).toService(McpServerManager);
        bind(GLSPServerListener).toService(McpServerManager);
    });
}
