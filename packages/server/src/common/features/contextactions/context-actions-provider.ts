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
import { EditorContext, LabeledAction, MaybePromise } from '@eclipse-glsp/protocol';

export const ContextActionsProvider = Symbol('ContextActionsProvider');

/**
 * A provider for a certain contextId that provides {@link LabeledAction}s.
 */
export interface ContextActionsProvider {
    /**
     * The context id of the {@link ContextActionsProvider}.
     */
    contextId: string;

    /**
     * Returns a list of {@link LabeledAction}s for a given {@link EditorContext}.
     *
     * @param editorContext The editorContext for which the actions are returned.
     * @returns A list of {@link LabeledAction}s for a given {@link EditorContext}.
     */
    getActions(editorContext: EditorContext): MaybePromise<LabeledAction[]>;
}
