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

import { ClientSessionManager, Logger, NullLogger } from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { McpPromptResult, McpToolError } from '../../server';
import { DescribeDiagramArgs, DescribeDiagramMcpPromptHandler } from './describe-diagram-mcp-prompt-handler';

/** Build a handler with a {@link ClientSessionManager} stub that returns the supplied session ids. */
function buildHandler(sessionIds: string[]): DescribeDiagramMcpPromptHandler {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(ClientSessionManager).toConstantValue({
                getSessions: () => sessionIds.map(id => ({ id }))
            } as unknown as ClientSessionManager);
            bind(DescribeDiagramMcpPromptHandler).toSelf();
        })
    );
    return container.get(DescribeDiagramMcpPromptHandler);
}

function callCreateResult(handler: DescribeDiagramMcpPromptHandler, args: DescribeDiagramArgs): McpPromptResult {
    // Result type is `MaybePromise<McpPromptResult>` on the abstract base; the concrete handler returns synchronously.
    return (handler as unknown as { createResult: (a: DescribeDiagramArgs) => McpPromptResult }).createResult(args);
}

describe('DescribeDiagramMcpPromptHandler', () => {
    it('substitutes an explicit sessionId into the prompt text and emits a single user-role message', () => {
        const handler = buildHandler(['unique-session-zzz', 'other-session']);

        const result = callCreateResult(handler, { sessionId: 'unique-session-zzz' });

        expect(result.messages).to.have.lengthOf(1);
        expect(result.messages[0].role).to.equal('user');
        const content = result.messages[0].content as { type: 'text'; text: string };
        expect(content.type).to.equal('text');
        // Use a uniquely-shaped sessionId so this test fails if the value is hardcoded rather than substituted.
        expect(content.text).to.include('unique-session-zzz');
    });

    it('defaults to the single open session when sessionId is omitted', () => {
        const handler = buildHandler(['solo-session']);

        const result = callCreateResult(handler, {});

        const content = result.messages[0].content as { type: 'text'; text: string };
        expect(content.text).to.include('solo-session');
    });

    it('throws McpToolError listing the open sessions when ambiguous', () => {
        const handler = buildHandler(['session-a', 'session-b']);

        expect(() => callCreateResult(handler, {})).to.throw(McpToolError, /Multiple sessions open.*session-a.*session-b/);
    });

    it('throws McpToolError when no sessions are open', () => {
        const handler = buildHandler([]);

        expect(() => callCreateResult(handler, {})).to.throw(McpToolError, /No open diagram sessions/);
    });

    it('throws McpToolError when an explicit sessionId does not match any open session', () => {
        const handler = buildHandler(['real-session']);

        expect(() => callCreateResult(handler, { sessionId: 'ghost' })).to.throw(McpToolError, /Unknown sessionId: ghost/);
    });
});
