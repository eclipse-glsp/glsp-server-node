/********************************************************************************
 * Copyright (c) 2022 StMicroelectronics.
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
/**
 * TS implementation of the GLSP graph definition
 * (https://github.com/eclipse-glsp/glsp-server/tree/master/plugins/org.eclipse.glsp.graph/src-gen/org/eclipse/glsp/graph)
 * Parts of the implementation is derived from Sprotty's SModel API
 * (https://github.com/eclipse/sprotty/blob/master/packages/sprotty/src/base/model/smodel.ts)
 */
import { Args, DefaultTypes as types, Dimension, JsonPrimitive, Point } from '@eclipse-glsp/protocol';
import { GBoundsAware, GBoundsAwareBuilder } from './gbounds-aware';
import { GLayoutable, GLayoutableBuilder } from './glayoutable';
import { GModelRoot, GModelRootBuilder } from './gmodel-element';

export class GGraph extends GModelRoot implements GBoundsAware, GLayoutable {
    static override builder(): GGraphBuilder {
        return new GGraphBuilder(GGraph);
    }

    override type = types.GRAPH;
    position: Point = Point.ORIGIN;
    size?: Dimension;
    layoutOptions?: Args;
    [GBoundsAware] = true;
    [GLayoutable] = true;
}

export class GGraphBuilder<G extends GGraph = GGraph> extends GModelRootBuilder<G> {
    position(x: number, y: number): this;
    position(position: Point): this;
    position(positionOrX: Point | number, y?: number): this {
        return GBoundsAwareBuilder.position(this, positionOrX, y);
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
}
