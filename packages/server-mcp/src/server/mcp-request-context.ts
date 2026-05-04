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

import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { AsyncLocalStorage } from 'node:async_hooks';

export type McpRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Module-level `AsyncLocalStorage` carrying the SDK's per-request `extra` (notification sender,
 * progress token, request id, session id) for the duration of a tool/resource/prompt callback.
 *
 * The handler bases (tool / resource / prompt) wrap each registered SDK callback in
 * `mcpRequestContext.run(extra, () => …)`. Anything inside the handler — and any await chain
 * branching off it — can read the active context via {@link mcpRequestContext.getStore}.
 *
 * This lets {@link McpLogger} forward logs to the MCP client without every handler having to
 * thread `extra` through its own signature, and lets future progress-emission code (P1f / PNG
 * export) reach the same channel from inside `requestUntil` chains.
 *
 * Concurrent requests on the same MCP session each get their own AsyncLocalStorage frame —
 * no cross-talk. Code that runs OUTSIDE a request (init contributions, background timers)
 * sees `undefined` from `getStore()`.
 */
export const mcpRequestContext = new AsyncLocalStorage<McpRequestExtra>();
