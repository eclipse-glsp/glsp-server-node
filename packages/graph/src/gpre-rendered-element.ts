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

import { GModelElement, GModelElementBuilder } from './gmodel-element';
import { DefaultTypes } from '@eclipse-glsp/protocol';

/**
 * Pre-rendered elements contain HTML or SVG code to be transferred to the DOM. This can be useful to
 * render complex figures or to compute the view on the server instead of the client code.
 * Pre rendered elements are often used for the popup model that is created by a `PopupModelFactory`.
 * A popup model is rendered when hovering over a element and for many common use cases e.g rendering a tooltip
 * this model can be computed entirely on the server side.
 */
export class GPreRenderedElement extends GModelElement {
    static builder(): GPreRenderedElementBuilder {
        return new GPreRenderedElementBuilder(GPreRenderedElement).type(DefaultTypes.PRE_RENDERED);
    }

    code: string;
}

export class GPreRenderedElementBuilder<G extends GPreRenderedElement = GPreRenderedElement> extends GModelElementBuilder<G> {
    code(code: string): this {
        this.proxy.code = code;
        return this;
    }
}
