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

import { ClientId, GLabel, GModelElement, Logger, ModelState, NullLogger } from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { McpModelSerializer } from '../../resources/services/mcp-model-serializer';
import { DefaultMcpLabelProvider, McpElementsNotFoundError, McpIdAliasService, McpLabelProvider, McpToolResult } from '../../server';
import { QueryElementsInput, QueryElementsMcpToolHandler } from './query-elements-mcp-tool-handler';

function makeLabel(text: string): GLabel {
    // Set the prototype so `child instanceof GLabel` checks in the handler return true.
    return Object.assign(Object.create(GLabel.prototype), { id: 'label', type: 'label', text, children: [] }) as GLabel;
}

function makeElement(id: string, type: string, labelText?: string): GModelElement {
    return {
        id,
        type,
        children: labelText !== undefined ? [makeLabel(labelText)] : []
    } as unknown as GModelElement;
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

interface CapturingSerializer extends McpModelSerializer {
    /** Element arrays the handler passed to {@link serializeStructuredArray}, in call order. */
    capturedArrays: GModelElement[][];
}

function makeCapturingSerializer(): CapturingSerializer {
    const capturedArrays: GModelElement[][] = [];
    return {
        capturedArrays,
        serialize: () => 'serialized',
        serializeStructured: () => ({}),
        serializeArray: elements => elements.map(el => `- ${el.id} (${el.type})`).join('\n'),
        serializeStructuredArray: elements => {
            capturedArrays.push(elements);
            return { elements: elements.map(el => ({ id: el.id, type: el.type })) };
        }
    };
}

function buildHandler(elements: GModelElement[], serializer: McpModelSerializer = makeCapturingSerializer()): QueryElementsMcpToolHandler {
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
            bind(McpModelSerializer).toConstantValue(serializer);
            bind(McpLabelProvider).to(DefaultMcpLabelProvider);
            bind(QueryElementsMcpToolHandler).toSelf();
        })
    );
    return container.get(QueryElementsMcpToolHandler);
}

interface ListStructured {
    mode: 'list';
    matches: { id: string; type: string; label?: string }[];
    truncated: boolean;
}
interface InspectStructured {
    mode: 'inspect';
    elements: { id: string; type: string }[];
}

function callCreateResult(handler: QueryElementsMcpToolHandler, params: QueryElementsInput): Promise<McpToolResult> {
    return (handler as unknown as { createResult: (p: QueryElementsInput) => Promise<McpToolResult> }).createResult(params);
}

describe('QueryElementsMcpToolHandler', () => {
    describe('list mode (no `elementIds`)', () => {
        it('filters by `types` (only matching types are returned)', async () => {
            const handler = buildHandler([
                makeElement('n1', 'task:manual', 'Build'),
                makeElement('n2', 'task:automated', 'Deploy'),
                makeElement('e1', 'edge')
            ]);

            const result = await callCreateResult(handler, { sessionId: 's', types: ['task:manual'] });
            const structured = result.structuredContent as unknown as ListStructured;
            expect(structured.mode).to.equal('list');
            expect(structured.matches).to.have.lengthOf(1);
            expect(structured.matches[0].id).to.equal('n1');
        });

        it('matches `labelMatch` case-insensitively against direct GLabel children', async () => {
            const handler = buildHandler([
                makeElement('n1', 'task', 'Build artifact'),
                makeElement('n2', 'task', 'Deploy artifact'),
                makeElement('n3', 'task', 'Validate spec')
            ]);

            const result = await callCreateResult(handler, { sessionId: 's', labelMatch: 'ARTIFACT' });
            const ids = (result.structuredContent as unknown as ListStructured).matches.map(m => m.id);
            expect(ids).to.have.members(['n1', 'n2']);
        });

        it('combines `types` and `labelMatch` as AND', async () => {
            const handler = buildHandler([
                makeElement('n1', 'task:manual', 'Build artifact'),
                makeElement('n2', 'task:automated', 'Build artifact')
            ]);

            const result = await callCreateResult(handler, {
                sessionId: 's',
                types: ['task:manual'],
                labelMatch: 'build'
            });
            const matches = (result.structuredContent as unknown as ListStructured).matches;
            expect(matches).to.have.lengthOf(1);
            expect(matches[0].id).to.equal('n1');
        });

        it('caps results at `limit` and reports `truncated: true`', async () => {
            const elements = Array.from({ length: 10 }, (_, i) => makeElement(`n${i}`, 'task'));
            const handler = buildHandler(elements);

            const result = await callCreateResult(handler, { sessionId: 's', limit: 3 });
            const structured = result.structuredContent as unknown as ListStructured;
            expect(structured.matches).to.have.lengthOf(3);
            expect(structured.truncated).to.equal(true);
        });

        it('surfaces a no-match message and empty matches when nothing matches', async () => {
            const handler = buildHandler([makeElement('n1', 'task', 'foo')]);

            const result = await callCreateResult(handler, { sessionId: 's', types: ['nonexistent'] });
            const text = (result.content[0] as { text: string }).text;
            expect(text).to.include('No elements matched');
            expect((result.structuredContent as unknown as ListStructured).matches).to.deep.equal([]);
        });
    });

    describe('inspect mode (with `elementIds`)', () => {
        it('resolves the requested ids and forwards the matching elements to the serializer', async () => {
            const elements = [makeElement('n1', 'task:manual', 'Build'), makeElement('n2', 'task:automated', 'Deploy')];
            const serializer = makeCapturingSerializer();
            const handler = buildHandler(elements, serializer);

            const result = await callCreateResult(handler, { sessionId: 's', elementIds: ['n1', 'n2'] });

            // The handler delegated rendering to the injected serializer with the exact
            // GModelElement instances looked up from the model index — not just the ids. Inspect
            // mode also probes per-element to detect container expansion before rendering, so the
            // final array call is what produces the structuredContent — assert on that one.
            expect(serializer.capturedArrays.length).to.be.greaterThan(0);
            const finalCall = serializer.capturedArrays[serializer.capturedArrays.length - 1];
            expect(finalCall).to.deep.equal(elements);

            const structured = result.structuredContent as unknown as InspectStructured;
            expect(structured.mode).to.equal('inspect');
        });

        it('throws McpElementsNotFoundError when an id is missing from the model', async () => {
            const handler = buildHandler([makeElement('n1', 'task')]);

            try {
                await callCreateResult(handler, { sessionId: 's', elementIds: ['n1', 'unknown'] });
                expect.fail('expected McpElementsNotFoundError');
            } catch (err) {
                expect(err).to.be.instanceOf(McpElementsNotFoundError);
            }
        });

        it('ignores `types` / `labelMatch` / `limit` when `elementIds` is set', async () => {
            const handler = buildHandler([makeElement('n1', 'task:manual'), makeElement('n2', 'task:automated')]);

            const result = await callCreateResult(handler, {
                sessionId: 's',
                elementIds: ['n1'],
                types: ['task:automated'], // would exclude n1 in list mode
                labelMatch: 'nope',
                limit: 0 // intentionally would fail validation in list mode
            });
            const structured = result.structuredContent as unknown as InspectStructured;
            expect(structured.mode).to.equal('inspect');
            expect(structured.elements.map(e => e.id)).to.deep.equal(['n1']);
        });
    });
});
