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
import { Args } from '@eclipse-glsp/protocol';

export namespace ArgsUtil {
    export const KEY_EDGE_PADDING = 'edgePadding';
    export const KEY_RADIUS_TOP_LEFT = 'radiusTopLeft';
    export const KEY_RADIUS_TOP_RIGHT = 'radiusTopRight';
    export const KEY_RADIUS_BOTTOM_RIGHT = 'radiusBottomRight';
    export const KEY_RADIUS_BOTTOM_LEFT = 'radiusBottomLeft';

    export function getEdgePadding(args: Args): number | undefined {
        return getNumber(args, KEY_EDGE_PADDING);
    }

    export function cornerRadius(radius: number): Args {
        return {
            [KEY_RADIUS_TOP_RIGHT]: radius,
            [KEY_RADIUS_BOTTOM_LEFT]: radius,
            [KEY_RADIUS_BOTTOM_RIGHT]: radius,
            [KEY_RADIUS_TOP_RIGHT]: radius
        };
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
