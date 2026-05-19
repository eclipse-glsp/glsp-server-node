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

import { BindingTarget } from '@eclipse-glsp/server';
import { AbstractMcpServerModule, DEFAULT_MCP_OPTIONS } from '../../common/modules/abstract-mcp-server-module';
import { AbstractMcpServerLauncher } from '../../common/server/abstract-mcp-server-launcher';
import { McpServerDefaults } from '../../common/server/mcp-options';
import { McpRequestContext } from '../../common/server/mcp-request-context';
import { BrowserMcpRequestContext } from '../server/browser-mcp-request-context';
import { WebMcpServerLauncher } from '../server/web-mcp-server-launcher';

/**
 * Default {@link AbstractMcpServerModule} entry point for browser/web hosts (Bun, Deno, Cloudflare
 * Worker, Service Worker, in-page Worker). Ships GLSP-default option values (see
 * {@link BrowserMcpServerModule.DEFAULT_OPTIONS}) on top of the abstract module's hook defaults,
 * and binds the web {@link WebMcpServerLauncher} + {@link BrowserMcpRequestContext}. Adopter-provided
 * overrides via the constructor merge on top.
 *
 * Node-only deploy-side fields (`host`, `allowedHosts`, `allowedOrigins`, `acknowledgedNoAuth`)
 * are intentionally omitted from defaults — adopters set these for their deployment, or run their
 * own auth middleware around {@link AbstractMcpServerLauncher.getRequestHandler}.
 *
 * @experimental The MCP integration is under active development. Option names, schema shapes,
 * and handler contracts MAY change in minor releases until the feature graduates from
 * experimental status.
 */
export class BrowserMcpServerModule extends AbstractMcpServerModule {
    static readonly DEFAULT_OPTIONS: McpServerDefaults = { ...DEFAULT_MCP_OPTIONS };

    constructor(overrides: McpServerDefaults = {}) {
        super({ ...BrowserMcpServerModule.DEFAULT_OPTIONS, ...overrides });
    }

    protected override bindMcpServerLauncher(): BindingTarget<AbstractMcpServerLauncher> {
        return WebMcpServerLauncher;
    }

    protected override bindMcpRequestContext(): BindingTarget<McpRequestContext> {
        return BrowserMcpRequestContext;
    }
}
