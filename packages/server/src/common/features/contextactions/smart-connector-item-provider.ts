/********************************************************************************
 * Copyright (c) 2023 Business Informatics Group (TU Wien) and others.
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
    PaletteItem,
    SmartConnectorGroupItem,
    EditorContext,
    LabeledAction,
    MaybePromise,
    SmartConnectorPosition,
    SmartConnectorGroupUIType,
    SmartConnectorNodeItem,
    TriggerNodeCreationAction
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { CreateOperationHandler } from '../../operations/create-operation-handler';
import { OperationHandlerRegistry } from '../../operations/operation-handler-registry';
import { ContextActionsProvider } from './context-actions-provider';
import { Logger } from '../../utils/logger';

/**
 * A {@link ContextActionsProvider} for {@link PaletteItem}s in the Smart Connector which appears when a node is selected.
 */
@injectable()
export abstract class SmartConnectorItemProvider implements ContextActionsProvider {
    /**
     * Returns the context id of the provider.
     */
    get contextId(): string {
        return 'smart-connector';
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
    abstract getItems(args?: Args): MaybePromise<SmartConnectorGroupItem[]>;
}

export type SmartConnectorSettings = {
    position: SmartConnectorPosition
    showTitle: true;
    submenu: boolean;
    showOnlyForChildren?: SmartConnectorGroupUIType
  } | {
    position: SmartConnectorPosition
    showTitle: false;
    showOnlyForChildren?: SmartConnectorGroupUIType
  };

@injectable()
export class DefaultSmartConnectorItemProvider extends SmartConnectorItemProvider {

    @inject(OperationHandlerRegistry) protected operationHandlerRegistry: OperationHandlerRegistry;
    @inject(Logger)
    protected logger: Logger;

    protected counter: number;

    protected smartConnectorNodeSettings: SmartConnectorSettings = {
        position: SmartConnectorPosition.Right,
        showTitle: true,
        submenu: true,
        showOnlyForChildren: SmartConnectorGroupUIType.Icons
    };

    protected smartConnectorEdgeSettings: SmartConnectorSettings = {
        position: SmartConnectorPosition.Right,
        showTitle: true,
        submenu: false
    };
    /** filter that excludes nodes/edges from options, given a node ID as key */
    protected nodeOperationFilter: Record<string, string[] | undefined> = {};

    /** edge that is used between source and destination by default when a new node is created
     *  (if not given, no edge will be created when creating new node) */
    protected defaultEdge?: string;

    /** list of edges where the key is a node ID and the value is a edge ID
     *  the edge to a new node when the source node has the ID of the key
     *  otherwise, the default edge will be used */
    protected edgeTypes: Record<string, string | undefined>;

    getItems(args?: Args): SmartConnectorGroupItem[] {
        const handlers = this.operationHandlerRegistry.getAll().filter(CreateOperationHandler.is) as CreateOperationHandler[];
        this.counter = 0;
        const nodes = this.createSmartConnectorGroupItem(handlers, CreateNodeOperation.KIND, args?.nodeType as string,
            this.smartConnectorNodeSettings.showOnlyForChildren);
        const edges = this.createSmartConnectorGroupItem(handlers, CreateEdgeOperation.KIND, args?.nodeType as string,
            this.smartConnectorEdgeSettings.showOnlyForChildren);
        return [
            {
                id: 'smart-connector-node-group',
                label: 'Nodes',
                actions: [],
                children: nodes,
                icon: 'symbol-property',
                sortString: 'A',
                ...this.smartConnectorNodeSettings
            },
            {
                id: 'smart-connector-edge-group',
                label: 'Edges',
                actions: [],
                children: edges,
                icon: 'symbol-property',
                sortString: 'B',
                ...this.smartConnectorEdgeSettings
            }
        ];
    }

    protected createSmartConnectorGroupItem(handlers: CreateOperationHandler[], kind: string, selectedNodeType: string,
            showOnly?: SmartConnectorGroupUIType): PaletteItem[] {
        const includedInNodeFilter = (e: string): boolean => !!this.nodeOperationFilter[selectedNodeType]?.includes(e);
        const paletteItems = handlers
            .filter(handler => handler.operationType === kind && (selectedNodeType &&
                this.nodeOperationFilter[selectedNodeType] ? !handler.elementTypeIds.some(includedInNodeFilter) : true))
            .map(handler => handler.getTriggerActions().map(
                action => this.createSmartConnectorItems(action, handler.label, selectedNodeType)))
            .reduce((accumulator, value) => accumulator.concat(value), [])
            .sort((a, b) => a.sortString.localeCompare(b.sortString));
        if (showOnly === SmartConnectorGroupUIType.Icons) {
            if (paletteItems.every(paletteItem => paletteItem.icon !== '')) {
                this.logger.warn('Not all elements have icons. Labels will be shown, check settings for smart connector.');
                return paletteItems;
            }
            paletteItems.forEach(paletteItem => paletteItem.label = '');
        }
        else if (showOnly === SmartConnectorGroupUIType.Labels) {
            paletteItems.forEach(paletteItem => paletteItem.icon = '');
        }
        return paletteItems;
    }

    protected createSmartConnectorItems(action: PaletteItem.TriggerElementCreationAction,
        label: string, nodeType: string): PaletteItem | SmartConnectorNodeItem {
        if (TriggerNodeCreationAction.is(action)) {
            let edgeType = this.edgeTypes[nodeType];
            if (!edgeType) {edgeType = this.defaultEdge;}
            return {
                id: `smart-connector-palette-item${this.counter++}`,
                sortString: label.charAt(0),
                label,
                actions: [action],
                edgeType: edgeType
            };
        }
        return {
            id: `smart-connector-palette-item${this.counter++}`,
            sortString: label.charAt(0),
            label,
            actions: [action]
        };
    }

}
