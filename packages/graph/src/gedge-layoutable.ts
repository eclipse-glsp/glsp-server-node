/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
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
import { EdgeSide } from '@eclipse-glsp/protocol';
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export interface GEdgePlacement {
    rotate: boolean;
    side: EdgeSide;
    position: number;
    offset: number;
}

export const GEdgeLayoutable = Symbol('GEdgeLayoutable');

export interface GEdgeLayoutable {
    edgePlacement?: GEdgePlacement;
    [GEdgeLayoutable]: boolean;
}

export function isGEdgeLayoutable<G extends GModelElement>(element: G): element is G & GEdgeLayoutable {
    return GEdgeLayoutable in element && element[GEdgeLayoutable] === true;
}

export type GEdgeLayoutableBuilder<G extends GModelElement = GModelElement> = GModelElementBuilder<G & GEdgeLayoutable>;

export namespace GEdgeLayoutableBuilder {
    export function edgePlacement<B extends GEdgeLayoutableBuilder>(builder: B, placement?: GEdgePlacement): B {
        builder['proxy'].edgePlacement = placement;
        return builder;
    }
}
