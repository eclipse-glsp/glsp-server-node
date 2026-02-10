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
import { GLSPServerInitContribution, GLSPServerListener, bindAsService } from '@eclipse-glsp/server';
import { ContainerModule } from 'inversify';
import { DefaultMcpResourceContribution } from './default-mcp-resource-contribution';
import { DefaultMcpToolContribution } from './default-mcp-tool-contribution';
import { McpServerContribution } from './mcp-server-contribution';
import { McpServerManager } from './mcp-server-manager';

export function configureMcpModule(): ContainerModule {
    return new ContainerModule(bind => {
        bind(McpServerManager).toSelf().inSingletonScope();
        bind(GLSPServerInitContribution).toService(McpServerManager);
        bind(GLSPServerListener).toService(McpServerManager);

        // Register default MCP contributions for resources and tools
        bindAsService(bind, McpServerContribution, DefaultMcpResourceContribution);
        bindAsService(bind, McpServerContribution, DefaultMcpToolContribution);
    });
}
