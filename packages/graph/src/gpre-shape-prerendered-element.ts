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

import { Dimension, Point } from '@eclipse-glsp/protocol';
import { GAlignable } from './galignable';
import { GBoundsAware, GBoundsAwareBuilder } from './gbound-aware';
import { GModelElementBuilder } from './gmodel-element';
import { GPreRenderedElement } from './gpre-rendered-element';

/**
 * Pre-rendered elements contain HTML or SVG code to be transferred to the DOM. This can be useful to
 * render complex figures or to compute the view on the server instead of the client code.
 * Pre rendered elements are often used for the popup model that is created by a `PopupModelFactory`.
 * A popup model is rendered when hovering over a element and for many common use cases e.g rendering a tooltip
 * this model can be computed entirely on the server side.
 */
export class GShapePreRenderedElement extends GPreRenderedElement implements GBoundsAware, GAlignable {
    static override builder(): GShapePreRenderedElementBuilder {
        return new GShapePreRenderedElementBuilder(GShapePreRenderedElement);
    }

    [GBoundsAware] = true;
    [GAlignable] = true;
    position: Point;
    size: Dimension;
    alignment: Point;
}

export class GShapePreRenderedElementBuilder<
    G extends GShapePreRenderedElement = GShapePreRenderedElement
> extends GModelElementBuilder<G> {
    code(code: string): this {
        this.proxy.code = code;
        return this;
    }

    position(x: number, y: number): this;
    position(position: Point): this;
    position(pointOrX: Point | number, y?: number): this {
        return GBoundsAwareBuilder.position(this, pointOrX, y);
    }

    size(width: number, height: number): this;
    size(size: Dimension): this;
    size(sizeOrWidth: Dimension | number, height?: number): this {
        return GBoundsAwareBuilder.size(this, sizeOrWidth, height);
    }
}
