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
import { EditorContext, NavigationTarget } from '@eclipse-glsp/protocol';

export const NavigationTargetProvider = Symbol('NavigationTargetProviders');

/**
 * This provider retrieves navigation targets for its target type from a given {@link EditorContext}.
 */
export interface NavigationTargetProvider {
    /**
     * Specifies the navigation targets for the given target type.
     *
     * If the `args` of a returned {@link NavigationTarget} contain a
     * {@link NavigationTarget.ELEMENT_IDS_SEPARATOR}, GLSP diagram clients should navigate to
     * the model elements with the specified ID within the current diagram. Multiple element
     * IDs can be concatenated with {@link NavigationTarget.ELEMENT_IDS_SEPARATOR}.
     *
     * If the `args` of a returned {@link NavigationTarget} contain a property
     * `JSON_OPENER_OPTIONS` and its uri is outside of the current diagram, the string
     * value of the `JSON_OPENER_OPTIONS` property will be parsed as JSON
     * and merged into the opener options by the Theia integration of the GLSP client.
     * This allows GLSP servers to pass additional opener options, such as a selection, etc.
     * Other clients (non-Theia clients) should behave the same way.
     *
     * @param editorContext The editor context
     * @returns the list of navigation targets
     */
    getTargets(editorContext: EditorContext): NavigationTarget[];

    /**
     * Returns the targetTypeId of the provider.
     *
     * @returns The targetTypeId of the provider.
     */
    targetTypeId: string;
}
