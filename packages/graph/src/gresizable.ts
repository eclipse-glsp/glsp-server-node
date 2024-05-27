/********************************************************************************
 * Copyright (c) 2024 EclipseSource and others.
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

export const GResizable = Symbol('GResizable');

export interface GResizable {
    resizeLocations?: GResizeLocation[];
    [GResizable]: boolean;
}

export function isGResizable<G extends GModelElement>(element: G): element is G & GResizable {
    return GResizable in element && element[GResizable] === true;
}

export type GResizableBuilder<G extends GModelElement = GModelElement> = GModelElementBuilder<G & GResizable>;

export namespace GResizableBuilder {
    export function resizeLocations<B extends GResizableBuilder>(builder: B, resizeLocations?: GResizeLocation[]): B {
        const proxy = builder['proxy'];
        proxy.resizeLocations = resizeLocations;
        return builder;
    }
}

export enum GResizeLocation {
    TopLeft = 'top-left',
    Top = 'top',
    TopRight = 'top-right',
    Right = 'right',
    BottomRight = 'bottom-right',
    Bottom = 'bottom',
    BottomLeft = 'bottom-left',
    Left = 'left'
}

export namespace GResizeLocation {
    export const CORNERS: GResizeLocation[] = [
        GResizeLocation.TopLeft,
        GResizeLocation.TopRight,
        GResizeLocation.BottomRight,
        GResizeLocation.BottomLeft
    ];
    export const CROSS: GResizeLocation[] = [GResizeLocation.Top, GResizeLocation.Right, GResizeLocation.Bottom, GResizeLocation.Left];
    export const ALL: GResizeLocation[] = [...GResizeLocation.CORNERS, ...GResizeLocation.CROSS];
}
