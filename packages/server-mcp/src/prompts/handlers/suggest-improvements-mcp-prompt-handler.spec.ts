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
import { McpPromptResult } from '../../server';
import { SuggestImprovementsArgs, SuggestImprovementsMcpPromptHandler } from './suggest-improvements-mcp-prompt-handler';

/** Build a handler with a {@link ClientSessionManager} stub that returns the supplied session ids. */
function buildHandler(sessionIds: string[]): SuggestImprovementsMcpPromptHandler {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(ClientSessionManager).toConstantValue({
                getSessions: () => sessionIds.map(id => ({ id }))
            } as unknown as ClientSessionManager);
            bind(SuggestImprovementsMcpPromptHandler).toSelf();
        })
    );
    return container.get(SuggestImprovementsMcpPromptHandler);
}

function callCreateResult(handler: SuggestImprovementsMcpPromptHandler, args: SuggestImprovementsArgs): McpPromptResult {
    return (handler as unknown as { createResult: (a: SuggestImprovementsArgs) => McpPromptResult }).createResult(args);
}

// The shared session-resolution error paths (no sessions / ambiguous / unknown sessionId) are
// covered by `describe-diagram-mcp-prompt-handler.spec.ts` against the same `AbstractMcpPromptHandler`
// base. This file only verifies the suggest-improvements-specific prompt-template substitution.
describe('SuggestImprovementsMcpPromptHandler', () => {
    it('substitutes the resolved sessionId into the suggest-improvements prompt template', () => {
        const handler = buildHandler(['unique-session-yyy', 'other-session']);

        const result = callCreateResult(handler, { sessionId: 'unique-session-yyy' });

        expect(result.messages).to.have.lengthOf(1);
        expect(result.messages[0].role).to.equal('user');
        const content = result.messages[0].content as { type: 'text'; text: string };
        expect(content.type).to.equal('text');
        expect(content.text).to.include('unique-session-yyy');
        // Prompt-template marker unique to suggest-improvements (not present in describe-diagram).
        // Catches a regression where the wrong template is wired up.
        expect(content.text).to.include('must-fix');
    });
});
