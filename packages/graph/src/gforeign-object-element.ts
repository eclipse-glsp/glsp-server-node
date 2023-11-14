/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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

import { GShapePreRenderedElementBuilder, GShapedPreRenderedElement } from './gshaped-prerendered-element';

/**
 * A `foreignObject` element to be transferred to the DOM within the SVG.
 *
 * This can be useful to to benefit from e.g. HTML rendering features, such as line wrapping, inside of
 * the SVG diagram.  Note that `foreignObject` is not supported by all browsers and SVG viewers may not
 * support rendering the `foreignObject` content.
 *
 * If no dimensions are specified in the schema element, this element will obtain the dimension of
 * its parent to fill the entire available room. Thus, this element requires specified bounds itself
 * or bounds to be available for its parent.
 */
export class GForeignObjectElement extends GShapedPreRenderedElement {
    static override builder(): GForeignObjectElementBuilder {
        return new GForeignObjectElementBuilder(GForeignObjectElement);
    }
    namespace: string;
}

export class GForeignObjectElementBuilder<
    G extends GForeignObjectElement = GForeignObjectElement
> extends GShapePreRenderedElementBuilder<G> {
    namespace(namespace: string): this {
        this.proxy.namespace = namespace;
        return this;
    }
}
