/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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
import { GModelElement } from '@eclipse-glsp/graph';
import { Args, LabeledAction, Point } from '@eclipse-glsp/protocol';
import { CommandPaletteActionProvider } from './command-palette-action-provider';
import { ContextActionsProvider } from './context-actions-provider';
import { ContextActionsProviderRegistry } from './context-actions-provider-registry';
import { DefaultToolPaletteItemProvider } from './tool-palette-item-provider';
import { expect } from 'chai';

describe('Test DefaultContextActionsProviderRegistry', () => {
    it('check if default registry is empty', () => {
        const contextActionsProvider: ContextActionsProvider[] = [];
        const contextActionsProviderRegistry = new ContextActionsProviderRegistry(contextActionsProvider);
        expect(contextActionsProviderRegistry.keys()).to.have.length(0);
    });

    it('register DefaultToolPaletteItemProvider via ContextActionsProviders list', () => {
        const contextActionsProvider: ContextActionsProvider[] = [new DefaultToolPaletteItemProvider()];
        const contextActionsProviderRegistry = new ContextActionsProviderRegistry(contextActionsProvider);
        expect(contextActionsProviderRegistry.keys()).to.have.length(1);
    });

    it('register DefaultToolPaletteItemProvider via ToolPaletteItemProvider', () => {
        const contextActionsProvider: ContextActionsProvider[] = [];
        const contextActionsProviderRegistry = new ContextActionsProviderRegistry(
            contextActionsProvider,
            undefined,
            undefined,
            new DefaultToolPaletteItemProvider()
        );
        expect(contextActionsProviderRegistry.keys()).to.have.length(1);
    });

    it('register CustomCommandPaletteActionProvider via CommandPaletteActionProvider', () => {
        class CustomCommandPaletteActionProvider extends CommandPaletteActionProvider {
            getPaletteActions(
                _selectedElementIds: string[],
                _selectedElements: GModelElement[],
                _position: Point,
                _args?: Args
            ): LabeledAction[] {
                return [];
            }
        }

        const contextActionsProvider: ContextActionsProvider[] = [];
        const contextActionsProviderRegistry = new ContextActionsProviderRegistry(
            contextActionsProvider,
            undefined,
            new CustomCommandPaletteActionProvider(),
            undefined
        );
        expect(contextActionsProviderRegistry.keys()).to.have.length(1);
    });
});
