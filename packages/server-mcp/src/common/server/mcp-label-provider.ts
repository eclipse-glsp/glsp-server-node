/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

import { GLabel, GModelElement } from '@eclipse-glsp/server';
import { injectable } from 'inversify';

export const McpLabelProvider = Symbol('McpLabelProvider');

/**
 * Locates the {@link GLabel} that primarily represents an element to a user. Centralises the
 * label-lookup logic so both LLM-facing reads (label-text echoes in tool results,
 * `query-elements` rendering) and writes (`ApplyLabelEditOperation` from `create-nodes` /
 * `modify-nodes`) share one override point.
 *
 * Diagram-scope: bound per GLSP session via {@link DefaultMcpDiagramModule.bindLabelProvider}.
 * Adopters with non-trivial label structures (nested headers, compartments) override the
 * {@link DefaultMcpLabelProvider} once instead of per-handler.
 *
 * @experimental
 */
export interface McpLabelProvider {
    /**
     * The {@link GLabel} primarily representing this element to a user. Returns `undefined`
     * when the element has no label.
     */
    getLabel(element: GModelElement): GLabel | undefined;
}

/**
 * Default {@link McpLabelProvider}: returns the first direct {@link GLabel} child. Adopters
 * whose elements wrap labels in intermediary container nodes (headers, compartments) subclass
 * and override {@link getLabel}.
 */
@injectable()
export class DefaultMcpLabelProvider implements McpLabelProvider {
    getLabel(element: GModelElement): GLabel | undefined {
        return element.children.find((child): child is GLabel => child instanceof GLabel);
    }
}
