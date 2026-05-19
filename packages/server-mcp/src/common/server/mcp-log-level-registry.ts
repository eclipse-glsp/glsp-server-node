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

import { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { injectable } from 'inversify';

export const McpLogLevelRegistry = Symbol('McpLogLevelRegistry');

/**
 * Per-MCP-session minimum-severity threshold for `notifications/message`. Updated by the
 * server's `logging/setLevel` request handler (registered in {@link AbstractMcpServerLauncher} on
 * session-init); read by {@link McpLogger} to gate message delivery.
 *
 * Bound as a server-scope singleton: one registry shared across MCP sessions, keyed by
 * session id. On session-close, the entry is cleared so a recycled session id does not
 * inherit a stale threshold.
 */
export interface McpLogLevelRegistry {
    /** Update the minimum severity for a session. Called by the SDK setLevel request handler. */
    setLevel(sessionId: string, level: LoggingLevel): void;
    /** Resolve the active threshold for a session, falling back to the default for unknown ids. */
    getLevel(sessionId: string | undefined): LoggingLevel;
    /** Drop the per-session entry on session-close. */
    clear(sessionId: string): void;
}

/**
 * RFC 5424 severity numbering, mirroring the MCP `LoggingLevel` enum. Lower number = more
 * severe; the threshold compares numerically.
 */
const SEVERITY: Record<LoggingLevel, number> = {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7
};

/**
 * Returns `true` iff a message of severity {@link level} should be delivered given the
 * session's current {@link threshold}. A `setLevel('warning')` call drops `notice`, `info`,
 * and `debug`; `setLevel('debug')` keeps everything (the default).
 */
export function passesLogThreshold(level: LoggingLevel, threshold: LoggingLevel): boolean {
    return SEVERITY[level] <= SEVERITY[threshold];
}

@injectable()
export class DefaultMcpLogLevelRegistry implements McpLogLevelRegistry {
    /**
     * Default threshold used when the client has not sent `logging/setLevel`. `'debug'` is the
     * MCP-spec-permitted "send everything" mode (the spec lets the server decide if no
     * setLevel was received). Set wide so adopters who never wire setLevel see the same
     * verbose behavior the server had before this registry existed.
     */
    static readonly DEFAULT_LEVEL: LoggingLevel = 'debug';

    protected readonly levels = new Map<string, LoggingLevel>();

    setLevel(sessionId: string, level: LoggingLevel): void {
        this.levels.set(sessionId, level);
    }

    getLevel(sessionId: string | undefined): LoggingLevel {
        if (sessionId === undefined) {
            return DefaultMcpLogLevelRegistry.DEFAULT_LEVEL;
        }
        return this.levels.get(sessionId) ?? DefaultMcpLogLevelRegistry.DEFAULT_LEVEL;
    }

    clear(sessionId: string): void {
        this.levels.delete(sessionId);
    }
}
