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
import { Args, Dimension, JsonPrimitive, Point } from '@eclipse-glsp/protocol';
import { GBoundsAware, GBoundsAwareBuilder } from './gbounds-aware';
import { GLayoutable, GLayoutableBuilder } from './glayoutable';
import { GModelElement, GModelElementBuilder } from './gmodel-element';
import { GResizable, GResizableBuilder, GResizeLocation } from './gresizable';

export abstract class GShapeElement extends GModelElement implements GBoundsAware, GLayoutable, GResizable {
    layoutOptions?: Args;
    position: Point;
    size: Dimension;
    resizeLocations?: GResizeLocation[];
    [GBoundsAware] = true;
    [GLayoutable] = true;
    [GResizable] = true;
}

export class GShapeElementBuilder<G extends GShapeElement> extends GModelElementBuilder<G> {
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

    addLayoutOption(key: string, value: JsonPrimitive): this {
        return GLayoutableBuilder.addLayoutOption(this, key, value);
    }

    addLayoutOptions(layoutOptions: Args): this;
    addLayoutOptions(layoutOptions: Map<string, JsonPrimitive>): this;
    addLayoutOptions(layoutOptions: Args | Map<string, JsonPrimitive>): this {
        return GLayoutableBuilder.addLayoutOptions(this, layoutOptions);
    }

    resizeLocations(resizeLocations?: GResizeLocation[]): this {
        return GResizableBuilder.resizeLocations(this, resizeLocations);
    }
}
