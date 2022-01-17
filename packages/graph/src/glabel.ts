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
import { DefaultTypes, ORIGIN_POINT, Point } from '@eclipse-glsp/protocol';
import { GAlignable, GAlignableBuilder } from './galignable';
import { EdgePlacement, GEdgeLayoutable, GEdgeLayoutableBuilder } from './gedge-layoutable';
import { GModelElementConstructor } from './gmodel-element';
import { GShapeElement, GShapeElementBuilder } from './gshape-element';

export class GLabel extends GShapeElement implements GAlignable, GEdgeLayoutable {
    static builder<G extends GLabel = GLabel>(constructor?: GModelElementConstructor<G>): GLabelBuilder {
        return new GLabelBuilder(constructor ?? GLabel).type(DefaultTypes.LABEL);
    }

    type = DefaultTypes.LABEL;
    text: string;
    alignment: Point = ORIGIN_POINT;
    edgePlacement?: EdgePlacement;
    [GAlignable] = true;
    [GEdgeLayoutable] = true;
}

export class GLabelBuilder<G extends GLabel = GLabel> extends GShapeElementBuilder<G> {
    alignment(x: number, y: number): this;
    alignment(alignment: Point): this;
    alignment(xOrAlign: number | Point, y?: number): this {
        return GAlignableBuilder.alignment(this, xOrAlign, y);
    }

    text(text: string): this {
        this.proxy.text = text;
        return this;
    }

    edgePlacement(placement: EdgePlacement): this {
        return GEdgeLayoutableBuilder.edgePlacement(this, placement);
    }
}
