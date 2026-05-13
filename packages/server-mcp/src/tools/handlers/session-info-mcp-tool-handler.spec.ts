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

import { ClientSession, ClientSessionManager, CommandStack, Logger, ModelState, NullLogger } from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { McpToolResult } from '../../server/mcp-handler-shared';
import { SessionInfoMcpToolHandler } from './session-info-mcp-tool-handler';

function asText(result: McpToolResult): string {
    const block = result.content[0];
    if (!block || block.type !== 'text') throw new Error('expected text content');
    return block.text;
}

/** Build a {@link ClientSession} stub whose container resolves a fixed {@link ModelState} + {@link CommandStack}. */
function makeSession(
    id: string,
    diagramType: string,
    sourceUri: string | undefined,
    isReadonly: boolean,
    isDirty: boolean = false
): ClientSession {
    const sessionContainer = new Container();
    const modelStateStub: Partial<ModelState> = { sourceUri, isReadonly };
    sessionContainer.bind(ModelState).toConstantValue(modelStateStub as ModelState);
    const commandStackStub: Partial<CommandStack> = { isDirty };
    sessionContainer.bind(CommandStack).toConstantValue(commandStackStub as CommandStack);
    return {
        id,
        diagramType,
        container: sessionContainer,
        // The handler does not exercise this dispatcher, but the interface requires it.
        actionDispatcher: {} as ClientSession['actionDispatcher'],
        dispose: () => {
            //
        }
    };
}

class StubClientSessionManager implements ClientSessionManager {
    constructor(private readonly sessions: ClientSession[]) {}

    getOrCreateClientSession(): ClientSession {
        throw new Error('not implemented');
    }
    getSession(sessionId?: string): ClientSession | undefined {
        return this.sessions.find(s => s.id === sessionId);
    }
    getSessions(): ClientSession[] {
        return this.sessions;
    }
    getSessionsByType(): ClientSession[] {
        return [];
    }
    disposeClientSession(): boolean {
        return true;
    }
    addListener(): boolean {
        return true;
    }
    removeListener(): boolean {
        return true;
    }
    removeListeners(): void {
        //
    }
}

function buildHandler(sessions: ClientSession[]): SessionInfoMcpToolHandler {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(ClientSessionManager).toConstantValue(new StubClientSessionManager(sessions));
            bind(SessionInfoMcpToolHandler).toSelf().inSingletonScope();
        })
    );
    return container.get(SessionInfoMcpToolHandler);
}

interface SessionRow {
    sessionId: string;
    diagramType: string;
    sourceUri: string;
    readOnly: boolean;
    dirty: boolean;
}

describe('SessionInfoMcpToolHandler', () => {
    it('summarizes each session by id and diagram type when sessions exist', () => {
        const handler = buildHandler([
            makeSession('session-alpha', 'workflow-diagram', 'file:///alpha.wf', false),
            makeSession('session-beta', 'state-diagram', 'file:///beta.sd', true)
        ]);

        const result = handler['createResult']({});
        const text = asText(result);
        // Summary lists each session's id and diagram type — the load-bearing referenceable bits.
        expect(text).to.include('session-alpha');
        expect(text).to.include('session-beta');
        expect(text).to.include('workflow-diagram');
        expect(text).to.include('state-diagram');
        // Full per-session detail goes via structuredContent.
        const sessions = (result.structuredContent as { sessions: SessionRow[] }).sessions;
        expect(sessions.map(row => row.sessionId)).to.deep.equal(['session-alpha', 'session-beta']);
    });

    it("passes through `sourceUri` and `readOnly` from each session container's ModelState via structuredContent", () => {
        const handler = buildHandler([makeSession('s1', 'workflow-diagram', 'file:///only.wf', true, /* isDirty */ false)]);

        const result = handler['createResult']({});
        const sessions = (result.structuredContent as { sessions: SessionRow[] }).sessions;
        expect(sessions).to.have.lengthOf(1);
        expect(sessions[0].sourceUri).to.equal('file:///only.wf');
        expect(sessions[0].readOnly).to.equal(true);
        expect(sessions[0].dirty).to.equal(false);
        // Read-only state is also surfaced in the text summary so content-only clients can see it.
        expect(asText(result)).to.include('read-only');
    });

    it('filters to a single session when `sessionId` matches', () => {
        const handler = buildHandler([
            makeSession('session-alpha', 'workflow-diagram', 'file:///alpha.wf', false),
            makeSession('session-beta', 'state-diagram', 'file:///beta.sd', true)
        ]);

        const text = asText(handler['createResult']({ sessionId: 'session-beta' }));

        expect(text).to.include('session-beta');
        expect(text).to.not.include('session-alpha');
    });

    it('throws McpToolError when the requested `sessionId` does not exist', () => {
        const handler = buildHandler([makeSession('session-alpha', 'workflow-diagram', 'file:///alpha.wf', false)]);

        expect(() => handler['createResult']({ sessionId: 'unknown' })).to.throw(/Unknown sessionId: unknown/);
    });
});
