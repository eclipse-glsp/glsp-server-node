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
import { Dimension, Point } from '@eclipse-glsp/protocol';
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export const GBoundsAware = Symbol('GBoundsAware');

export interface GBoundsAware {
    position?: Point;
    size?: Dimension;
    [GBoundsAware]: boolean;
}

export function isGBoundsAware<G extends GModelElement>(element: G): element is G & GBoundsAware {
    return GBoundsAware in element && element[GBoundsAware] === true;
}

export type GBoundsAwareBuilder<G extends GModelElement = GModelElement> = GModelElementBuilder<G & GBoundsAware>;

export namespace GBoundsAwareBuilder {
    export function position<B extends GBoundsAwareBuilder>(builder: B, pointOrX: Point | number, y?: number): B {
        const proxy = builder['proxy'];
        if (typeof pointOrX === 'object') {
            proxy.position = pointOrX;
        } else if (y) {
            proxy.position = { x: pointOrX, y };
        }
        return builder;
    }

    export function size<B extends GBoundsAwareBuilder>(builder: B, sizeOrWidth: Dimension | number, height?: number): B {
        const proxy = builder['proxy'];
        if (typeof sizeOrWidth === 'object') {
            proxy.size = sizeOrWidth;
        } else if (height) {
            proxy.size = { width: sizeOrWidth, height };
        }
        return builder;
    }
}
