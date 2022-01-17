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
import { Args, EditorContext, LabeledAction, Point } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { GModelState } from '../../base-impl/gmodel-state';
import { ContextActionsProvider } from './context-actions-provider';

/**
 * A {@link ContextActionsProvider} for CommandPaletteActions.
 */
@injectable()
export abstract class CommandPaletteActionProvider implements ContextActionsProvider {
    @inject(GModelState)
    protected modelState: GModelState;

    readonly TEXT = 'text';
    readonly INDEX = 'index';

    /**
     * Returns the context id of the provider.
     */
    get contextId(): string {
        return 'command-palette';
    }

    /**
     * Retrieves the value for the "text" key from the given arguments {@link Args}.
     *
     * @param args The given arguments.
     * @returns The value associated with the "text" key.
     */
    getText(args: Args): string {
        return args[this.TEXT] ? args[this.TEXT].toString() : '';
    }

    /**
     * Returns the value of the "index" key from a given {@link Args}.
     *
     * @param args The given arguments.
     * @returns The value associated with the "index" key.
     */
    getIndex(args: Args): number {
        return args[this.INDEX] ? (args[this.INDEX] as number) : 0.0;
    }

    /**
     * Returns a list of {@link LabeledAction}s for a given {@link EditorContext}.
     *
     * @param editorContext The editorContext for which the actions are returned.
     * @returns A list of {@link LabeledAction}s for a given {@link EditorContext}.
     */
    getActions(editorContext: EditorContext): LabeledAction[] {
        const actions: LabeledAction[] = [];
        if (this.modelState.isReadonly) {
            return actions;
        }

        const selectedIds = editorContext.selectedElementIds;
        const position = editorContext.lastMousePosition ? editorContext.lastMousePosition : { x: 0, y: 0 };
        const selectedElements = this.modelState.index.getAll(selectedIds);

        return this.getPaletteActions(selectedIds, selectedElements, position, editorContext.args);
    }

    /**
     * Returns a list of {@link LabeledAction}s for given selectedElements at a given mouse position.
     *
     * @param selectedElementIds The list of currently selected elementIds.
     * @param selectedElements The list of currently selected elements.
     * @param position The current mouse position.
     * @param args Additional arguments.
     * @returns A list of {@link LabeledAction}s.
     */
    abstract getPaletteActions(
        selectedElementIds: string[],
        selectedElements: GModelElement[],
        position: Point,
        args?: Args
    ): LabeledAction[];
}
