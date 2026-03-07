/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

import { injectable, multiInject } from 'inversify';
import { FEATURE_FLAGS } from '../feature-flags';
import { GLSPMcpServer, McpResourceHandler, McpServerContribution } from '../server';

/**
 * MCP server contribution that provides read-only resources for accessing
 * GLSP server state, including sessions, element types, and diagram models.
 *
 * This contribution should not be overriden or extended if another resource is required.
 * Instead, a new {@link McpResourceHandler} should be registered like:
 * @example
 * bindAsService(bind, McpResourceHandler, SessionsListMcpResourceHandler);
 */
@injectable()
export class McpResourceContribution implements McpServerContribution {
    @multiInject(McpResourceHandler)
    protected mcpResourceHandlers: McpResourceHandler[];

    configure(server: GLSPMcpServer): void {
        // TODO currently only development tool
        // think of nice switching mechanism for starting MCP servers with only tools or tools + resources
        if (FEATURE_FLAGS.useResources) {
            this.mcpResourceHandlers.forEach(handler => handler.registerResource(server));
        } else {
            this.mcpResourceHandlers.forEach(handler => handler.registerTool(server));
        }
    }
}
