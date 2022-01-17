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
import {
    Args,
    CreateEdgeOperation,
    CreateNodeOperation,
    EditorContext,
    LabeledAction,
    MaybePromise,
    TriggerElementCreationAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { CreateOperationHandler } from '../../operations/create-operation-handler';
import { OperationHandlerRegistry } from '../../operations/operation-handler-registry';
import { ContextActionsProvider } from './context-actions-provider';

/**
 * A {@link ContextActionsProvider} for {@link PaletteItem}s.
 */
@injectable()
export abstract class ToolPaletteItemProvider implements ContextActionsProvider {
    /**
     * Returns the context id of the provider.
     */
    get contextId(): string {
        return 'tool-palette';
    }

    /**
     * Returns a list of {@link LabeledAction}s for a given {@link EditorContext}.
     *
     * @param editorContext The editorContext for which the actions are returned.
     * @returns A list of {@link LabeledAction}s for a given {@link EditorContext}.
     */
    async getActions(editorContext: EditorContext): Promise<LabeledAction[]> {
        return this.getItems(editorContext.args);
    }

    /**
     * Constructs a list of {@link PaletteItem}s for a given map of string arguments.
     *
     * @param args A map of string arguments.
     * @returns A list of {@link PaletteItem}s for a given map of string arguments.
     */
    abstract getItems(args?: Args): MaybePromise<PaletteItem[]>;
}

@injectable()
export class DefaultToolPaletteItemProvider extends ToolPaletteItemProvider {
    @inject(OperationHandlerRegistry) operationHandlerRegistry: OperationHandlerRegistry;
    protected counter: number;

    getItems(args?: Args): PaletteItem[] {
        const handlers = this.operationHandlerRegistry
            .getAll()
            .filter(handler => handler instanceof CreateOperationHandler) as CreateOperationHandler[];
        this.counter = 0;
        const nodes = this.createPaletteItem(handlers, CreateNodeOperation.KIND);
        const edges = this.createPaletteItem(handlers, CreateEdgeOperation.KIND);
        return [
            PaletteItem.createPaletteGroup('node-group', 'Nodes', nodes, 'symbol-property', 'A'),
            PaletteItem.createPaletteGroup('edge-group', 'Edges', edges, 'symbol-property', 'B')
        ];
    }

    createPaletteItem(handlers: CreateOperationHandler[], kind: string): PaletteItem[] {
        return handlers
            .filter(handler => handler.operationType === kind)
            .map(handler => handler.getTriggerActions().map(action => this.create(action, handler.label)))
            .reduce((accumulator, value) => accumulator.concat(value), [])
            .sort((a, b) => a.sortString.localeCompare(b.sortString));
    }

    create(action: TriggerElementCreationAction, label: string): PaletteItem {
        return new PaletteItem(`palette-item${this.counter}`, label, action);
    }
}

export class PaletteItem extends LabeledAction {
    id: string;
    sortString: string;
    children: PaletteItem[];

    constructor(id: string, label: string, initializeAction?: TriggerElementCreationAction, icon?: string) {
        super(label, initializeAction ? [initializeAction] : [], icon);
        this.sortString = label.charAt(0);
        this.id = id;
    }

    static createPaletteGroup(id: string, label: string, children: PaletteItem[], icon?: string, sortString?: string): PaletteItem {
        const item = new PaletteItem(id, label, undefined, icon);
        item.children = children;
        if (sortString) {
            item.sortString = sortString;
        }
        return item;
    }
}
