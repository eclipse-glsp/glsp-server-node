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

import {
    Action,
    ActionDispatcher,
    ClientId,
    DiagramConfiguration,
    EdgeCreationChecker,
    EdgeTypeHint,
    GModelElement,
    Logger,
    ModelState,
    NullLogger
} from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { DefaultMcpLabelProvider, McpIdAliasService, McpLabelProvider, McpToolResult } from '../../server';
import { CreateEdgesInput, CreateEdgesMcpToolHandler } from './create-edges-mcp-tool-handler';

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
        },
        isReadonly: false
    } as unknown as ModelState;
}

class StubEdgeCreationChecker implements EdgeCreationChecker {
    public lastTargetCall?: { edgeType: string; source: GModelElement; target: GModelElement };
    constructor(private readonly result: boolean) {}
    isValidSource(): boolean {
        return this.result;
    }
    isValidTarget(edgeType: string, source: GModelElement, target: GModelElement): boolean {
        this.lastTargetCall = { edgeType, source, target };
        return this.result;
    }
}

interface BuildArgs {
    elements: GModelElement[];
    edgeTypeHints: Pick<EdgeTypeHint, 'elementTypeId' | 'dynamic'>[];
    checker?: EdgeCreationChecker;
}

/** Records dispatched actions so create-mode tests can assert no dispatch happened. */
class RecordingDispatcher {
    public dispatched: Action[] = [];
    async dispatch(action: Action): Promise<void> {
        this.dispatched.push(action);
    }
    async dispatchAll(): Promise<void> {
        // not used by create-edges
    }
    dispatchAfterNextUpdate(): void {
        // not used
    }
}

function buildHandler({ elements, edgeTypeHints, checker }: BuildArgs): {
    handler: CreateEdgesMcpToolHandler;
    dispatcher: RecordingDispatcher;
} {
    const dispatcher = new RecordingDispatcher();
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
            bind(DiagramConfiguration).toConstantValue({ edgeTypeHints } as unknown as DiagramConfiguration);
            bind(ActionDispatcher).toConstantValue(dispatcher as unknown as ActionDispatcher);
            if (checker) {
                bind(EdgeCreationChecker).toConstantValue(checker);
            }
            bind(McpLabelProvider).to(DefaultMcpLabelProvider);
            bind(CreateEdgesMcpToolHandler).toSelf();
        })
    );
    return { handler: container.get(CreateEdgesMcpToolHandler), dispatcher };
}

function callCreateResult(handler: CreateEdgesMcpToolHandler, params: CreateEdgesInput): Promise<McpToolResult> {
    return (handler as unknown as { createResult: (p: CreateEdgesInput) => Promise<McpToolResult> }).createResult(params);
}

interface DryRunStructured {
    createdEdges: { id: string; elementTypeId: string; label?: string }[];
    errors: string[];
    validationResults: { edgeType: string; sourceElementId: string; targetElementId: string; isValid: boolean; reason?: string }[];
}

describe('CreateEdgesMcpToolHandler · dryRun', () => {
    const baseInput = (overrides: Partial<CreateEdgesInput> = {}): CreateEdgesInput => ({
        sessionId: 's',
        dryRun: true,
        edges: [{ elementTypeId: 'edge:dynamic', sourceElementId: 's', targetElementId: 't' }],
        ...overrides
    });

    it('returns isValid:true with a "no dynamic hint" reason when the edgeType has no dynamic hint', async () => {
        const { handler, dispatcher } = buildHandler({
            elements: [makeElement('s', 'task'), makeElement('t', 'task')],
            edgeTypeHints: [{ elementTypeId: 'edge:static', dynamic: false }]
        });

        const result = await callCreateResult(
            handler,
            baseInput({ edges: [{ elementTypeId: 'edge:static', sourceElementId: 's', targetElementId: 't' }] })
        );

        const structured = result.structuredContent as unknown as DryRunStructured;
        expect(structured.validationResults).to.have.lengthOf(1);
        expect(structured.validationResults[0].isValid).to.equal(true);
        expect(structured.validationResults[0].reason).to.match(/no dynamic edge-type hint/i);
        expect(structured.createdEdges).to.deep.equal([]);
        expect(dispatcher.dispatched).to.have.lengthOf(0);
    });

    it('flags isValid:false with a config-gap reason when edgeType declares a dynamic hint but no checker is bound', async () => {
        const { handler, dispatcher } = buildHandler({
            elements: [makeElement('s', 'task'), makeElement('t', 'task')],
            edgeTypeHints: [{ elementTypeId: 'edge:dynamic', dynamic: true }]
        });

        const result = await callCreateResult(handler, baseInput());

        const structured = result.structuredContent as unknown as DryRunStructured;
        expect(structured.validationResults[0].isValid).to.equal(false);
        expect(structured.validationResults[0].reason).to.include('EdgeCreationChecker is not bound');
        expect(dispatcher.dispatched).to.have.lengthOf(0);
    });

    it('delegates to EdgeCreationChecker.isValidTarget when target + dynamic hint + checker are present', async () => {
        const sourceElement = makeElement('s', 'task');
        const targetElement = makeElement('t', 'task');
        const checker = new StubEdgeCreationChecker(false);
        const { handler, dispatcher } = buildHandler({
            elements: [sourceElement, targetElement],
            edgeTypeHints: [{ elementTypeId: 'edge:dynamic', dynamic: true }],
            checker
        });

        const result = await callCreateResult(handler, baseInput());

        expect(checker.lastTargetCall).to.deep.equal({
            edgeType: 'edge:dynamic',
            source: sourceElement,
            target: targetElement
        });
        const structured = result.structuredContent as unknown as DryRunStructured;
        expect(structured.validationResults[0].isValid).to.equal(false);
        expect(dispatcher.dispatched).to.have.lengthOf(0);
    });

    it('reports source/target not-found inline as a per-edge validation failure (does not throw)', async () => {
        const { handler } = buildHandler({
            elements: [makeElement('s', 'task')],
            edgeTypeHints: [{ elementTypeId: 'edge:dynamic', dynamic: true }]
        });

        const result = await callCreateResult(
            handler,
            baseInput({ edges: [{ elementTypeId: 'edge:dynamic', sourceElementId: 's', targetElementId: 'missing' }] })
        );
        const structured = result.structuredContent as unknown as DryRunStructured;
        expect(structured.validationResults[0].isValid).to.equal(false);
        expect(structured.validationResults[0].reason).to.include('Target element not found');
    });
});
