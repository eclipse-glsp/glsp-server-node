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
    ApplyLabelEditOperation,
    ClientId,
    CreateNodeOperation,
    GLabel,
    GModelElement,
    Logger,
    ModelState,
    NullLogger
} from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { McpToolResult } from '../../server/mcp-handler-shared';
import { McpIdAliasService } from '../../server/mcp-id-alias-service';
import { McpLabelProvider } from '../../server/mcp-label-provider';
import { CreateNodesInput, CreateNodesMcpToolHandler } from './create-nodes-mcp-tool-handler';

interface CreatedElementsStructured {
    createdNodes: { id: string; elementTypeId: string; label?: string }[];
    errors: string[];
    warnings: string[];
}

function makeElement(id: string, type: string, children: GModelElement[] = []): GModelElement {
    return { id, type, children } as unknown as GModelElement;
}

/** Mutable model that drops in new elements as CreateNodeOperations are dispatched. */
class FakeModelState {
    public elements = new Map<string, GModelElement>();
    constructor(initial: GModelElement[]) {
        initial.forEach(el => this.elements.set(el.id, el));
    }
    addElement(el: GModelElement): void {
        this.elements.set(el.id, el);
    }
    get index(): ModelState['index'] {
        return {
            allIds: () => [...this.elements.keys()],
            get: (id: string) => this.elements.get(id),
            find: (id: string) => this.elements.get(id)
        } as unknown as ModelState['index'];
    }
    get isReadonly(): boolean {
        return false;
    }
}

/** Dispatcher that materializes a new element per `CreateNodeOperation` and records the action. */
class CreatingDispatcher {
    public dispatched: Action[] = [];
    private idCounter = 0;
    constructor(
        private readonly model: FakeModelState,
        private readonly labeled: Set<string>
    ) {}

    async dispatch(action: Action): Promise<void> {
        this.dispatched.push(action);
        if (CreateNodeOperation.is(action)) {
            const id = `${action.elementTypeId}#${++this.idCounter}`;
            const children: GModelElement[] = this.labeled.has(action.elementTypeId)
                ? [Object.assign(new GLabel(), { id: `${id}_label`, type: 'label', children: [] })]
                : [];
            this.model.addElement(makeElement(id, action.elementTypeId, children));
        }
    }
}

interface BuildArgs {
    /** Element types whose newly created instance includes a child GLabel. */
    labeled?: string[];
    /** Element types for which CreateNodeOperation should produce no new element (silent failure simulation). */
    failed?: string[];
}

function buildHandler({ labeled = [], failed = [] }: BuildArgs = {}): {
    handler: CreateNodesMcpToolHandler;
    dispatcher: CreatingDispatcher;
} {
    const model = new FakeModelState([]);
    const failedSet = new Set(failed);
    const labeledSet = new Set(labeled);
    const dispatcher = new (class extends CreatingDispatcher {
        override async dispatch(action: Action): Promise<void> {
            if (CreateNodeOperation.is(action) && failedSet.has(action.elementTypeId)) {
                this.dispatched.push(action);
                return;
            }
            return super.dispatch(action);
        }
    })(model, labeledSet);

    const container = new Container();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new NullLogger());
            bind(ClientId).toConstantValue('test-session');
            bind(ModelState).toConstantValue(model as unknown as ModelState);
            bind(McpIdAliasService).toConstantValue({
                lookup: (id: string) => id,
                alias: (id: string) => id
            } as McpIdAliasService);
            bind(ActionDispatcher).toConstantValue(dispatcher as unknown as ActionDispatcher);
            bind(McpLabelProvider).toConstantValue({
                getLabel: (element: GModelElement) => element.children.find(c => c instanceof GLabel) as GLabel | undefined
            } as McpLabelProvider);
            bind(CreateNodesMcpToolHandler).toSelf();
        })
    );
    return { handler: container.get(CreateNodesMcpToolHandler), dispatcher };
}

function callCreateResult(handler: CreateNodesMcpToolHandler, params: CreateNodesInput): Promise<McpToolResult> {
    return (handler as unknown as { createResult: (p: CreateNodesInput) => Promise<McpToolResult> }).createResult(params);
}

describe('CreateNodesMcpToolHandler', () => {
    it('dispatches one CreateNodeOperation per node and reports the new element ids', async () => {
        const { handler, dispatcher } = buildHandler();

        const result = await callCreateResult(handler, {
            sessionId: 's',
            nodes: [
                { elementTypeId: 'task:manual', position: { x: 0, y: 0 } },
                { elementTypeId: 'task:manual', position: { x: 100, y: 0 } }
            ]
        });

        const structured = result.structuredContent as unknown as CreatedElementsStructured;
        expect(structured.createdNodes).to.have.lengthOf(2);
        expect(structured.createdNodes[0].id).to.equal('task:manual#1');
        expect(structured.createdNodes[1].id).to.equal('task:manual#2');
        expect(structured.errors).to.deep.equal([]);
        expect(structured.warnings).to.deep.equal([]);
        expect(dispatcher.dispatched.filter(CreateNodeOperation.is)).to.have.lengthOf(2);
    });

    it('dispatches ApplyLabelEditOperation when `text` is supplied and the new element has a label', async () => {
        const { handler, dispatcher } = buildHandler({ labeled: ['task:manual'] });

        await callCreateResult(handler, {
            sessionId: 's',
            nodes: [{ elementTypeId: 'task:manual', position: { x: 0, y: 0 }, text: 'Hello' }]
        });

        const edits = dispatcher.dispatched.filter(ApplyLabelEditOperation.is);
        expect(edits).to.have.lengthOf(1);
        expect(edits[0].text).to.equal('Hello');
        expect(edits[0].labelId).to.equal('task:manual#1_label');
    });

    it('emits a warning (no ApplyLabelEditOperation) when `text` is supplied but the element type has no label', async () => {
        const { handler, dispatcher } = buildHandler({ labeled: [] });

        const result = await callCreateResult(handler, {
            sessionId: 's',
            nodes: [{ elementTypeId: 'decision', position: { x: 0, y: 0 }, text: 'Ignored' }]
        });

        const structured = result.structuredContent as unknown as CreatedElementsStructured;
        expect(structured.warnings).to.have.lengthOf(1);
        expect(structured.warnings[0]).to.match(/no editable label/i);
        expect(dispatcher.dispatched.filter(ApplyLabelEditOperation.is)).to.have.lengthOf(0);
    });

    it('records an error and skips label-edit when the CreateNodeOperation produces no new element', async () => {
        const { handler, dispatcher } = buildHandler({ failed: ['ghost'] });

        const result = await callCreateResult(handler, {
            sessionId: 's',
            nodes: [{ elementTypeId: 'ghost', position: { x: 0, y: 0 }, text: 'Hello' }]
        });

        const structured = result.structuredContent as unknown as CreatedElementsStructured;
        expect(structured.createdNodes).to.deep.equal([]);
        expect(structured.errors).to.have.lengthOf(1);
        expect(structured.errors[0]).to.include('ghost');
        expect(dispatcher.dispatched.filter(ApplyLabelEditOperation.is)).to.have.lengthOf(0);
    });
});
