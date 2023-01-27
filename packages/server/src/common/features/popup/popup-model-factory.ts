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

import { GModelElement, GModelRoot } from '@eclipse-glsp/graph';
import { RequestPopupModelAction } from '@eclipse-glsp/protocol';

export const PopupModelFactory = Symbol('PopupModelFactory');

/**
 * A PopupModelFactory creates a popup model for the given element.
 * A popup model is a {@link GHtmlRoot} that is self contained and not part of the diagram model.
 * In contrast to diagram elements popup models typically don't contain dynamically rendered {@link GModelElement}s and
 * use{@link GPreRenderedElement}s that contain server-side computed html or svg code instead.
 */
export interface PopupModelFactory {
    /**
     * Returns an {@link GModelRoot} for a given {@link GModelElement} triggered by a
     * {@link RequestPopupModelAction}.
     *
     * @param element The element to create the popup model for.
     * @param action  The {@link RequestPopupModelAction} that triggered this popup model creation.
     * @returns An optional {@link GHtmlRoot} for a given {@link GModelElement}.
     */
    createPopupModel(element: GModelElement, action: RequestPopupModelAction): GModelRoot | undefined;
}
