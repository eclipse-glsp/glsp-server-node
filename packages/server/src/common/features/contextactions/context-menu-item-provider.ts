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
import { Args, EditorContext, LabeledAction, MenuItem, Point } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { ContextActionsProvider } from './context-actions-provider';

/**
 * A {@link ContextActionsProvider} for {@link MenuItem}s.
 */
@injectable()
export abstract class ContextMenuItemProvider implements ContextActionsProvider {
    /**
     * Returns the context id of the {@link ContextMenuItemProvider}.
     */
    get contextId(): string {
        return 'context-menu';
    }

    /**
     * Returns a list of {@link MenuItem}s for a given list of selected elements at a certain mouse position.
     *
     * @param selectedElementIds The list of currently selected elementIds.
     * @param position           The current mouse position.
     * @param args               Additional arguments.
     * @returns A list of {@link MenuItem}s for a given list of selected elements at a certain mouse position.
     */
    abstract getItems(selectedElementIds: string[], position: Point, args?: Args): MenuItem[];

    /**
     * Returns a list of {@link LabeledAction}s for a given {@link EditorContext}.
     *
     * @param editorContext The editorContext for which the actions are returned.
     * @returns A list of {@link LabeledAction}s for a given {@link EditorContext}.
     */
    getActions(editorContext: EditorContext): LabeledAction[] {
        const position = editorContext.lastMousePosition ? editorContext.lastMousePosition : { x: 0, y: 0 };
        return this.getItems(editorContext.selectedElementIds, position, editorContext.args);
    }
}
