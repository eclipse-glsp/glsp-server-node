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
import { Point } from '@eclipse-glsp/protocol';
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export const GAlignable = Symbol('GAlignable');

export interface GAlignable {
    alignment: Point;
    [GAlignable]: boolean;
}

export function isGAlignable<G extends GModelElement>(element: G): element is G & GAlignable {
    return ((element as any)[GAlignable] = true);
}

export type GAlignableBuilder<G extends GModelElement = GModelElement> = GModelElementBuilder<G & GAlignable>;

export namespace GAlignableBuilder {
    export function alignment<B extends GAlignableBuilder>(builder: B, pointOrX: Point | number, y?: number): B {
        const proxy = builder['proxy'];
        if (typeof pointOrX === 'object') {
            proxy.alignment = pointOrX;
        } else if (y) {
            proxy.alignment = { x: pointOrX, y };
        }
        return builder;
    }
}
