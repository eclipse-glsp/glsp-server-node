/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
import { inject, injectable, multiInject, optional } from 'inversify';
import { ContextActionsProviders } from '../../di/service-identifiers';
import { Registry } from '../../utils/registry';
import { CommandPaletteActionProvider } from './command-palette-action-provider';
import { ContextActionsProvider } from './context-actions-provider';
import { ContextMenuItemProvider } from './context-menu-item-provider';
import { ToolPaletteItemProvider } from './tool-palette-item-provider';
import { SmartConnectorItemProvider } from './smart-connector-item-provider';

/**
 * A registry that keeps track of all registered {@link ContextActionsProvider}s.
 */
@injectable()
export class ContextActionsProviderRegistry extends Registry<string, ContextActionsProvider> {
    constructor(
        @multiInject(ContextActionsProviders) @optional() contextActionsProvider: ContextActionsProvider[] = [],
        @inject(ContextMenuItemProvider) @optional() contextMenuItemProvider?: ContextMenuItemProvider,
        @inject(CommandPaletteActionProvider) @optional() commandPaletteActionProvider?: CommandPaletteActionProvider,
        @inject(ToolPaletteItemProvider) @optional() toolPaletteItemProvider?: ToolPaletteItemProvider,
        @inject(SmartConnectorItemProvider) @optional() smartConnectorItemProvider?: SmartConnectorItemProvider
    ) {
        super();
        contextActionsProvider.forEach(provider => this.register(provider.contextId, provider));
        if (contextMenuItemProvider) {
            this.register(contextMenuItemProvider.contextId, contextMenuItemProvider);
        }
        if (commandPaletteActionProvider) {
            this.register(commandPaletteActionProvider.contextId, commandPaletteActionProvider);
        }
        if (toolPaletteItemProvider) {
            this.register(toolPaletteItemProvider.contextId, toolPaletteItemProvider);
        }
        if (smartConnectorItemProvider) {
            this.register(smartConnectorItemProvider.contextId, smartConnectorItemProvider);
        }
    }
}
