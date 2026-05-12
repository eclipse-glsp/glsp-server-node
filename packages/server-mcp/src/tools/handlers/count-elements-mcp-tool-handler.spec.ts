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

import { ClientId, GModelElement, Logger, ModelState, NullLogger } from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { DefaultMcpLabelProvider, McpIdAliasService, McpLabelProvider, McpToolResult } from '../../server';
import { CountElementsMcpToolHandler } from './count-elements-mcp-tool-handler';

function makeElement(id: string, type: string): GModelElement {
    return { id, type, children: [] } as unknown as GModelElement;
}

function makeModelState(elements: GModelElement[]): ModelState {
    const byId = new Map(elements.map(el => [el.id, el]));
    return {
        index: {
            allIds: () => [...byId.keys()],
            get: (id: string) => byId.get(id),
            find: (id: string) => byId.get(id)
        }
    } as unknown as ModelState;
}

function buildHandler(elements: GModelElement[]): CountElementsMcpToolHandler {
    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(ClientId).toConstantValue('test-session');
            bind(ModelState).toConstantValue(makeModelState(elements));
            bind(McpIdAliasService).toConstantValue({
                lookup: (id: string) => id,
                alias: (id: string) => id
            } as McpIdAliasService);
            bind(McpLabelProvider).to(DefaultMcpLabelProvider);
            bind(CountElementsMcpToolHandler).toSelf();
        })
    );
    return container.get(CountElementsMcpToolHandler);
}

function callCreateResult(handler: CountElementsMcpToolHandler): Promise<McpToolResult> {
    return (handler as unknown as { createResult: (params: { sessionId: string }) => Promise<McpToolResult> }).createResult({
        sessionId: 'test-session'
    });
}

describe('CountElementsMcpToolHandler', () => {
    it('aggregates element counts grouped by `type`', async () => {
        const handler = buildHandler([
            makeElement('n1', 'task:manual'),
            makeElement('n2', 'task:manual'),
            makeElement('n3', 'task:automated'),
            makeElement('e1', 'edge')
        ]);

        const result = await callCreateResult(handler);
        expect(result.structuredContent).to.deep.equal({
            total: 4,
            countsByType: { 'task:manual': 2, 'task:automated': 1, edge: 1 }
        });
    });

    it('orders rendered rows by count desc, then type alpha asc on ties', async () => {
        const handler = buildHandler([
            makeElement('e1', 'edge'),
            makeElement('e2', 'edge'),
            makeElement('n1', 'task:automated'),
            makeElement('n2', 'task:manual'),
            makeElement('n3', 'task:manual')
        ]);

        const result = await callCreateResult(handler);
        const text = (result.content[0] as { text: string }).text;
        // Counts: edge=2, task:manual=2, task:automated=1.
        // Expected order: edge before task:manual (alpha tiebreak on count=2), then task:automated.
        const expectedOrder = ['edge', 'task:manual', 'task:automated'];
        const indices = expectedOrder.map(type => text.indexOf(`- ${type}: `));
        expect(
            indices.every(i => i >= 0),
            'expected all type rows to be rendered'
        ).to.equal(true);
        expect(indices).to.deep.equal([...indices].sort((a, b) => a - b));
    });
});
