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
import { mcpRequestContext } from './mcp-request-context';

/**
 * Per-call shape of a `notifications/progress` emission. Mirrors the SDK's
 * `ProgressNotificationParams` minus the `progressToken` field (the reporter pulls that from
 * the active request context — the caller's job is just to describe the progress beat).
 */
export interface McpProgressBeat {
    /** Monotonic progress count. Spec is loose; convention: increment from 0 toward `total` if known, or use seconds-elapsed otherwise. */
    progress: number;
    /** Total when known (e.g. number of nodes to process). Omit when bounded only by a timeout. */
    total?: number;
    /** Short user-facing description; surfaces in compatible clients' UI. */
    message?: string;
}

/**
 * Emits `notifications/progress` to the connected MCP client when the active request carries a
 * `progressToken` in its `_meta`. Built on the same {@link mcpRequestContext} as
 * {@link McpLogger}; handlers don't need to thread `extra` through their own signatures.
 *
 * Behaviour:
 *  - Outside a request context (init, background): no-op.
 *  - Inside a request context with no `progressToken` (client didn't opt in): no-op.
 *    Universally supported per spec — clients that don't render progress simply omit the token.
 *  - Failures to deliver are swallowed: a broken transport must not break the producing tool.
 *
 * Shared across MCP clients on the same GLSP session; per-client routing is handled by the
 * active `mcpRequestContext` frame.
 *
 * @experimental
 */
@injectable()
export class McpProgressReporter {
    async emit(beat: McpProgressBeat): Promise<void> {
        const extra = mcpRequestContext.getStore();
        const progressToken = extra?._meta?.progressToken;
        if (extra === undefined || progressToken === undefined) {
            return;
        }
        try {
            await extra.sendNotification({
                method: 'notifications/progress',
                params: { progressToken, ...beat }
            });
        } catch {
            // Fire-and-forget — never propagate transport errors into tool execution.
        }
    }
}
