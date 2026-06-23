/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
import { PaletteItem, RequestContextActions, SetContextActions } from '@eclipse-glsp/protocol';
import { describe, expect, it } from 'vitest';
import { OperationHandlerRegistry } from '../../operations/operation-handler-registry';
import * as mock from '../../test/mock-util';
import { ContextActionsProvider } from './context-actions-provider';
import { ContextActionsProviderRegistry } from './context-actions-provider-registry';
import { RequestContextActionsHandler } from './request-context-actions-handler';
import { DefaultToolPaletteItemProvider } from './tool-palette-item-provider';

describe('Test RequestContextActionsHandler', () => {
    const operationHandlerRegistry = new OperationHandlerRegistry();
    const stubANode = new mock.StubCreateNodeOperationHandler('ANode');
    const stubBNode = new mock.StubCreateNodeOperationHandler('BNode');
    const stubAEdge = new mock.StubCreateEdgeOperationHandler('AEdge');
    const stubBEdge = new mock.StubCreateEdgeOperationHandler('BEdge');
    operationHandlerRegistry.registerHandler(stubBNode);
    operationHandlerRegistry.registerHandler(stubANode);
    operationHandlerRegistry.registerHandler(stubBEdge);
    operationHandlerRegistry.registerHandler(stubAEdge);

    const contextActionsProvider: ContextActionsProvider[] = [];
    const toolPaletteItemProvider = new DefaultToolPaletteItemProvider();
    toolPaletteItemProvider.operationHandlerRegistry = operationHandlerRegistry;

    const contextActionsProviderRegistry = new ContextActionsProviderRegistry(
        contextActionsProvider,
        undefined,
        undefined,
        toolPaletteItemProvider
    );

    const requestContextActionsHandler = new RequestContextActionsHandler();
    requestContextActionsHandler['contextActionsProviderRegistry'] = contextActionsProviderRegistry;

    it('request ToolPaletteContextActions', async () => {
        const actions = await requestContextActionsHandler.execute(
            RequestContextActions.create({ contextId: 'tool-palette', editorContext: { selectedElementIds: [] } })
        );
        expect(actions).toHaveLength(1);
        const action = actions[0];

        expect(SetContextActions.is(action)).toBe(true);
        const setContextActions = action as SetContextActions;
        expect(setContextActions.actions).toHaveLength(2);

        expect(PaletteItem.is(setContextActions.actions[0])).toBe(true);
        const firstPaletteItem = setContextActions.actions[0] as PaletteItem;
        expect(firstPaletteItem.label).toBe('Nodes');
        expect(firstPaletteItem.children).toHaveLength(2);
        expect(firstPaletteItem.children?.[0].label).toBe('ANode');
        expect(firstPaletteItem.children?.[1].label).toBe('BNode');

        expect(PaletteItem.is(setContextActions.actions[1])).toBe(true);
        const secondPaletteItem = setContextActions.actions[1] as PaletteItem;
        expect(secondPaletteItem.label).toBe('Edges');
        expect(secondPaletteItem.children).toHaveLength(2);
        expect(secondPaletteItem.children?.[0].label).toBe('AEdge');
        expect(secondPaletteItem.children?.[1].label).toBe('BEdge');
    });
});
