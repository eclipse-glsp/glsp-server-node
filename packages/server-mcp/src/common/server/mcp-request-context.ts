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

export type McpRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export const McpRequestContext = Symbol('McpRequestContext');

/**
 * Carries the SDK's per-request `extra` (notification sender, progress token, request id,
 * session id) for the duration of a tool/resource/prompt callback so consumers like the MCP
 * logger and progress reporter can reach the client without threading `extra` through their
 * own signatures.
 */
export interface McpRequestContext {
    run<R>(extra: McpRequestExtra, callback: () => R): R;
    getStore(): McpRequestExtra | undefined;
}

/** No-op fallback used when no implementation is bound (e.g. in unit tests). */
export class NoopMcpRequestContext implements McpRequestContext {
    run<R>(_extra: McpRequestExtra, callback: () => R): R {
        return callback();
    }
    getStore(): McpRequestExtra | undefined {
        return undefined;
    }
}
