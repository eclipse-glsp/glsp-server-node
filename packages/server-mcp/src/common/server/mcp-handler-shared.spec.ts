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
import { expect } from 'chai';
import { McpToolError, resolveActiveSessionId } from './mcp-handler-shared';

function stubSessionManager(sessionIds: string[]): ClientSessionManager {
    return { getSessions: () => sessionIds.map(id => ({ id })) } as unknown as ClientSessionManager;
}

describe('resolveActiveSessionId', () => {
    it('returns the explicit session id when it matches an open session', () => {
        const result = resolveActiveSessionId(stubSessionManager(['alpha', 'beta']), 'alpha');
        expect(result).to.equal('alpha');
    });

    it('defaults to the only open session when sessionId is omitted', () => {
        const result = resolveActiveSessionId(stubSessionManager(['solo']), undefined);
        expect(result).to.equal('solo');
    });

    it('throws McpToolError listing the open sessions when ambiguous', () => {
        expect(() => resolveActiveSessionId(stubSessionManager(['session-a', 'session-b']), undefined)).to.throw(
            McpToolError,
            /Multiple sessions open.*session-a.*session-b/
        );
    });

    it('throws McpToolError when no sessions are open', () => {
        expect(() => resolveActiveSessionId(stubSessionManager([]), undefined)).to.throw(McpToolError, /No open diagram sessions/);
    });

    it('throws McpToolError when an explicit sessionId does not match any open session', () => {
        expect(() => resolveActiveSessionId(stubSessionManager(['real-session']), 'ghost')).to.throw(
            McpToolError,
            /Unknown sessionId: ghost/
        );
    });
});
