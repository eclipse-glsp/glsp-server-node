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

import { injectable } from 'inversify';
import { AbstractMcpServerLauncher, FullMcpServerConfiguration, TransportEndpoint } from '../../common/server/abstract-mcp-server-launcher';

/**
 * Web target for {@link AbstractMcpServerLauncher}. Web targets (Cloudflare Worker, Deno Deploy,
 * Bun, Service Worker, in-page Worker) have no socket to bind; the adopter plugs the inherited
 * {@link AbstractMcpServerLauncher.getRequestHandler} into their own listener. `bindTransport`
 * is therefore a no-op.
 *
 * **Adopter responsibilities.** Authentication is the adopter's job. The MCP server has no
 * built-in auth — wrap `getRequestHandler()` with whatever middleware your deployment requires
 * (bearer token, mTLS at proxy, Cloudflare Access, OAuth, etc.). Session state lives in memory
 * inside the launcher; multi-isolate / multi-region deployments that need shared session state
 * must subclass and override the session store.
 *
 * @see `examples/workflow-server-bundled-web/smoke.html` for a Web Worker-based example.
 */
@injectable()
export class WebMcpServerLauncher extends AbstractMcpServerLauncher {
    protected async bindTransport(_config: FullMcpServerConfiguration): Promise<TransportEndpoint> {
        return {};
    }
}
