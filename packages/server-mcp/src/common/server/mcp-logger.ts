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

import { Logger } from '@eclipse-glsp/server';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable, optional } from 'inversify';
import { McpLogLevelRegistry, passesLogThreshold } from './mcp-log-level-registry';
import { McpRequestContext, NoopMcpRequestContext } from './mcp-request-context';

/**
 * Logger that writes to BOTH the GLSP-side server log and the connected MCP client.
 *
 * Mirrors the {@link Logger} shape so handlers can drop-in switch from `@inject(Logger)` to
 * `@inject(McpLogger)`. The server-side route always fires; the MCP-side route fires only when
 * a call is made from inside an MCP request callback (tracked via {@link McpRequestContext}).
 *
 * We deliberately do NOT auto-forward arbitrary GLSP `Logger.info` calls to MCP clients —
 * that would leak unrelated server-wide log lines into every connected LLM. Adopters opt in
 * per-handler by injecting `McpLogger` instead of `Logger`.
 *
 * Level mapping (GLSP → MCP, RFC 5424 names per the MCP spec):
 *  - `info`  → `info`
 *  - `warn`  → `warning`
 *  - `error` → `error`
 *  - `debug` → `debug`
 *
 * Shared across MCP clients on the same GLSP session; per-client routing is handled by the
 * active `McpRequestContext` frame, and the per-MCP-session `logging/setLevel` threshold is
 * stored in {@link McpLogLevelRegistry}.
 *
 * @experimental
 */
@injectable()
export class McpLogger {
    @inject(McpRequestContext)
    @optional()
    protected requestContext: McpRequestContext = new NoopMcpRequestContext();

    @inject(Logger) protected glspLogger: Logger;

    @inject(McpLogLevelRegistry) protected levelRegistry: McpLogLevelRegistry;

    info(message: string, ...meta: unknown[]): void {
        this.glspLogger.info(message, ...meta);
        this.notify('info', message);
    }

    warn(message: string, ...meta: unknown[]): void {
        this.glspLogger.warn(message, ...meta);
        this.notify('warning', message);
    }

    error(message: string, ...meta: unknown[]): void {
        this.glspLogger.error(message, ...meta);
        this.notify('error', message);
    }

    debug(message: string, ...meta: unknown[]): void {
        this.glspLogger.debug(message, ...meta);
        this.notify('debug', message);
    }

    /**
     * Send a `notifications/message` to the connected MCP client when invoked inside an active
     * request context AND the message passes the session's `logging/setLevel` threshold.
     * Outside a request context (init contributions, background timers) this is a no-op so the
     * same logger can be used everywhere without orphan-notification leaks.
     *
     * Failures to deliver are swallowed — a broken transport must not break the producing tool.
     */
    protected notify(level: LoggingLevel, data: string): void {
        const extra = this.requestContext.getStore();
        if (!extra) {
            return;
        }
        const threshold = this.levelRegistry.getLevel(extra.sessionId);
        if (!passesLogThreshold(level, threshold)) {
            return;
        }
        extra.sendNotification({ method: 'notifications/message', params: { level, data } }).catch(() => undefined);
    }
}
