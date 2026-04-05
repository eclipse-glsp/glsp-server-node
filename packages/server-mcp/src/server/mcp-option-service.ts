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

import { McpServerOptions } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { McpServerContribution } from './mcp-server-contribution';
import { GLSPMcpServer } from './mcp-server-manager';

export const McpOptionService = Symbol('McpOptionService');

export interface McpOptionService {
    set(options: McpServerOptions): void;
    get(key: keyof McpServerOptions): any;
}

@injectable()
export class DefaultMcpOptionService implements McpOptionService {
    protected options: McpServerOptions;

    set(options: McpServerOptions): void {
        this.options = options;
    }

    get(key: keyof McpServerOptions): any {
        if (!this.options) {
            return undefined;
        }
        return this.options[key];
    }
}

@injectable()
export class McpOptionServiceContribution implements McpServerContribution {
    @inject(McpOptionService)
    protected mcpOptionService: McpOptionService;

    configure(server: GLSPMcpServer): void {
        this.mcpOptionService.set(server.options);
    }
}
