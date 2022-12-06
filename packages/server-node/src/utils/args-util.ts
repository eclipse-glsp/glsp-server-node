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
import { Args, Point } from '@eclipse-glsp/protocol';

export namespace ArgsUtil {
    export const KEY_EDGE_PADDING = 'edgePadding';
    export const KEY_EDGE_SOURCE_POINT_X = 'edgeSourcePointX';
    export const KEY_EDGE_SOURCE_POINT_Y = 'edgeSourcePointY';
    export const KEY_EDGE_TARGET_POINT_X = 'edgeTargetPointX';
    export const KEY_EDGE_TARGET_POINT_Y = 'edgeTargetPointY';

    export const KEY_RADIUS_TOP_LEFT = 'radiusTopLeft';
    export const KEY_RADIUS_TOP_RIGHT = 'radiusTopRight';
    export const KEY_RADIUS_BOTTOM_RIGHT = 'radiusBottomRight';
    export const KEY_RADIUS_BOTTOM_LEFT = 'radiusBottomLeft';

    export function cornerRadius(radius: number): Args;
    export function cornerRadius(topLeftBottomRight: number, topRightBottomLeft: number): Args;
    export function cornerRadius(topLeft: number, topRight: number, bottomRight: number, bottomLeft: number): Args;
    export function cornerRadius(radiusOrTopLeft: number, topRightOpt?: number, bottomRightOpt?: number, bottomLeftOpt?: number): Args {
        const topLeft = radiusOrTopLeft;
        let topRight = radiusOrTopLeft;
        let bottomLeft = radiusOrTopLeft;
        let bottomRight = radiusOrTopLeft;

        if (topRightOpt) {
            topRight = topRightOpt;
            if (bottomRightOpt && bottomLeftOpt) {
                bottomLeft = bottomLeftOpt;
                bottomRight = bottomRightOpt;
            } else {
                bottomRight = radiusOrTopLeft;
                bottomLeft = topRight;
            }
        }

        return {
            [KEY_RADIUS_TOP_RIGHT]: topLeft,
            [KEY_RADIUS_BOTTOM_LEFT]: bottomLeft,
            [KEY_RADIUS_BOTTOM_RIGHT]: bottomRight,
            [KEY_RADIUS_TOP_RIGHT]: topRight
        };
    }

    export function edgePadding(edgePadding: number): Args {
        return { [KEY_EDGE_PADDING]: edgePadding };
    }

    export function getEdgePadding(args: Args): number | undefined {
        return getNumber(args, KEY_EDGE_PADDING);
    }

    export function getEdgeSourcePoint(args: Args = {}): Point | undefined {
        const x = getNumber(args, KEY_EDGE_SOURCE_POINT_X);
        const y = getNumber(args, KEY_EDGE_SOURCE_POINT_Y);
        if (x && y) {
            return { x, y };
        }
        return undefined;
    }

    export function getEdgeTargetPoint(args: Args = {}): Point | undefined {
        const x = getNumber(args, KEY_EDGE_TARGET_POINT_X);
        const y = getNumber(args, KEY_EDGE_TARGET_POINT_Y);
        if (x && y) {
            return { x, y };
        }
        return undefined;
    }

    export function get(args: Args = {}, key: string): string | undefined {
        const value = args[key];
        return value && typeof value === 'string' ? value : undefined;
    }

    export function getNumber(args: Args = {}, key: string): number | undefined {
        const value = args[key];
        return value && typeof value === 'number' ? value : undefined;
    }

    export function getBoolean(args: Args = {}, key: string): boolean {
        const value = args[key];
        return value && typeof value === 'boolean' ? value : false;
    }
}
