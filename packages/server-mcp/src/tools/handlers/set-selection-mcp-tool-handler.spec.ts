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
    GModelElement,
    Logger,
    ModelState,
    NullLogger,
    SelectAction,
    SelectAllAction
} from '@eclipse-glsp/server';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { DefaultMcpLabelProvider, McpElementsNotFoundError, McpIdAliasService, McpLabelProvider, McpToolResult } from '../../server';
import { SetSelectionInput, SetSelectionMcpToolHandler } from './set-selection-mcp-tool-handler';

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

function makeRecordingDispatcher(): { dispatcher: ActionDispatcher; dispatched: Action[] } {
    const dispatched: Action[] = [];
    const dispatcher = {
        dispatch: async (action: Action) => {
            dispatched.push(action);
        }
    } as unknown as ActionDispatcher;
    return { dispatcher, dispatched };
}

function buildHandler(elements: GModelElement[], dispatcher: ActionDispatcher): SetSelectionMcpToolHandler {
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
            bind(ActionDispatcher).toConstantValue(dispatcher);
            bind(McpLabelProvider).to(DefaultMcpLabelProvider);
            bind(SetSelectionMcpToolHandler).toSelf();
        })
    );
    return container.get(SetSelectionMcpToolHandler);
}

function callCreateResult(handler: SetSelectionMcpToolHandler, params: SetSelectionInput): Promise<McpToolResult> {
    return (handler as unknown as { createResult: (p: SetSelectionInput) => Promise<McpToolResult> }).createResult(params);
}

describe('SetSelectionMcpToolHandler', () => {
    it('dispatches SelectAllAction(false) before SelectAction when `clear: true`', async () => {
        const { dispatcher, dispatched } = makeRecordingDispatcher();
        const handler = buildHandler([makeElement('n1', 'task'), makeElement('n2', 'task')], dispatcher);

        await callCreateResult(handler, { sessionId: 's', selectedElementIds: ['n1'], clear: true });

        expect(dispatched).to.have.lengthOf(2);
        expect(SelectAllAction.is(dispatched[0])).to.equal(true);
        expect((dispatched[0] as SelectAllAction).select).to.equal(false);
        expect(SelectAction.is(dispatched[1])).to.equal(true);
    });

    it('dispatches SelectAction with resolved selected and deselected ids', async () => {
        const { dispatcher, dispatched } = makeRecordingDispatcher();
        const handler = buildHandler([makeElement('a', 'task'), makeElement('b', 'task'), makeElement('c', 'task')], dispatcher);

        await callCreateResult(handler, { sessionId: 's', selectedElementIds: ['a', 'b'], deselectedElementIds: ['c'] });

        expect(dispatched).to.have.lengthOf(1);
        const action = dispatched[0] as SelectAction;
        expect(action.selectedElementsIDs).to.deep.equal(['a', 'b']);
        expect(action.deselectedElementsIDs).to.deep.equal(['c']);
    });

    it('throws McpElementsNotFoundError when an id is missing from the model', async () => {
        const { dispatcher } = makeRecordingDispatcher();
        const handler = buildHandler([makeElement('n1', 'task')], dispatcher);

        let error: unknown;
        try {
            await callCreateResult(handler, { sessionId: 's', selectedElementIds: ['n1', 'ghost'] });
        } catch (err: unknown) {
            error = err;
        }
        expect(error).to.be.instanceOf(McpElementsNotFoundError);
    });
});
