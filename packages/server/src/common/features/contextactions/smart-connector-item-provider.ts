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
    SmartConnectorGroupUIType
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { CreateOperationHandler } from '../../operations/create-operation-handler';
import { OperationHandlerRegistry } from '../../operations/operation-handler-registry';
import { ContextActionsProvider } from './context-actions-provider';
import { GLSPServerError } from '../../utils/glsp-server-error';



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
    abstract getItems(args?: Args): MaybePromise<PaletteItem[]>;
}

@injectable()
export class DefaultSmartConnectorItemProvider extends SmartConnectorItemProvider {
    @inject(OperationHandlerRegistry) operationHandlerRegistry: OperationHandlerRegistry;
    protected counter: number;

    // TODO
    protected defaultSmartConnectorNodeSettings = {
        position: SmartConnectorPosition.Top,
        showTitle: true,
        submenu: false,
        showOnlyForChildren: SmartConnectorGroupUIType.Icons
    }

    protected defaultSmartConnectorEdgeSettings = {
        position: SmartConnectorPosition.Right,
        showTitle: true,
        submenu: false
    }

    getItems(args?: Args): SmartConnectorGroupItem[] {
        if (args?.iconOnly && args?.labelOnly) throw new GLSPServerError('Settings for smart connector cannot contain iconOnly and labelOnly at the same time!');
        const handlers = this.operationHandlerRegistry.getAll().filter(CreateOperationHandler.is) as CreateOperationHandler[];
        this.counter = 0; 
        var maxNodes = args?.maxNodes as number;
        var maxEdges = args?.maxEdges as number;
        var iconOnly = args?.iconOnly as boolean;
        var labelOnly = args?.labelOnly as boolean;
        const nodes = this.createPaletteItem(handlers, CreateNodeOperation.KIND, maxNodes, iconOnly, labelOnly);
        const edges = this.createPaletteItem(handlers, CreateEdgeOperation.KIND, maxEdges, iconOnly, labelOnly);
        return [
            { id: 'node-group', label: 'Nodes', actions: [], children: nodes, icon: 'symbol-property', sortString: 'A', ...this.defaultSmartConnectorNodeSettings },
            { id: 'edge-group', label: 'Edges', actions: [], children: edges, icon: 'symbol-property', sortString: 'B', ...this.defaultSmartConnectorEdgeSettings }
        ];
    }

    createPaletteItem(handlers: CreateOperationHandler[], kind: string, maxElements?: number, iconOnly?: boolean, labelOnly?: boolean): PaletteItem[] {
        var paletteItems = handlers
            .filter(handler => handler.operationType === kind)
            .map(handler => handler.getTriggerActions().map(action => this.create(action, handler.label)))
            .reduce((accumulator, value) => accumulator.concat(value), [])
            .sort((a, b) => a.sortString.localeCompare(b.sortString));
        paletteItems.forEach(paletteItem => paletteItem.icon = !iconOnly ? paletteItem.icon : '')
        paletteItems.forEach(paletteItem => paletteItem.label = !labelOnly ? paletteItem.label : '')
        if (maxElements)
            return paletteItems.slice(0, maxElements);
        else
            return paletteItems;
    }

    create(action: PaletteItem.TriggerElementCreationAction, label: string): PaletteItem {
        return { id: `smart-connector-palette-item${this.counter}`, sortString: label.charAt(0), label, actions: [action] };
    }

}
