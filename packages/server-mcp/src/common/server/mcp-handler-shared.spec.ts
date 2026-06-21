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

import { ClientSessionManager } from '@eclipse-glsp/server';
import { describe, expect, it } from 'vitest';
import { McpToolError, resolveActiveSessionId } from './mcp-handler-shared';

function stubSessionManager(sessionIds: string[]): ClientSessionManager {
    return { getSessions: () => sessionIds.map(id => ({ id })) } as unknown as ClientSessionManager;
}

describe('resolveActiveSessionId', () => {
    it('returns the explicit session id when it matches an open session', () => {
        const result = resolveActiveSessionId(stubSessionManager(['alpha', 'beta']), 'alpha');
        expect(result).toBe('alpha');
    });

    it('defaults to the only open session when sessionId is omitted', () => {
        const result = resolveActiveSessionId(stubSessionManager(['solo']), undefined);
        expect(result).toBe('solo');
    });

    it('throws McpToolError listing the open sessions when ambiguous', () => {
        const act = (): string => resolveActiveSessionId(stubSessionManager(['session-a', 'session-b']), undefined);
        expect(act).toThrow(McpToolError);
        expect(act).toThrow(/Multiple sessions open.*session-a.*session-b/);
    });

    it('throws McpToolError when no sessions are open', () => {
        const act = (): string => resolveActiveSessionId(stubSessionManager([]), undefined);
        expect(act).toThrow(McpToolError);
        expect(act).toThrow(/No open diagram sessions/);
    });

    it('throws McpToolError when an explicit sessionId does not match any open session', () => {
        const act = (): string => resolveActiveSessionId(stubSessionManager(['real-session']), 'ghost');
        expect(act).toThrow(McpToolError);
        expect(act).toThrow(/Unknown sessionId: ghost/);
    });
});
