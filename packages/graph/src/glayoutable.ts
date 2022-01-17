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
import { Args, JsonPrimitive } from '@eclipse-glsp/protocol';
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export const GLayoutable = Symbol('GLayoutable');

export interface GLayoutable {
    layoutOptions?: Args;
    [GLayoutable]: boolean;
}

export function isGLayoutable<G extends GModelElement>(element: G): element is G & GLayoutable {
    return ((element as any)[GLayoutable] = true);
}

export type GLayoutableBuilder = GModelElementBuilder<GModelElement & GLayoutable>;

export namespace GLayoutableBuilder {
    export function addLayoutOption<B extends GLayoutableBuilder>(builder: B, key: string, value: JsonPrimitive): B {
        const proxy = builder['proxy'];
        if (!proxy.layoutOptions) {
            proxy.layoutOptions = {};
        }
        proxy.layoutOptions[key] = value;
        return builder;
    }

    export function addLayoutOptions<B extends GLayoutableBuilder>(builder: B, layoutOptions: Args | Map<string, JsonPrimitive>): B {
        const toAssign: Args = {};
        const proxy = builder['proxy'];
        if (layoutOptions instanceof Map) {
            [...layoutOptions.keys()].forEach(key => (toAssign[key] = layoutOptions.get(key)!));
        } else {
            Object.keys(layoutOptions).forEach(key => (toAssign[key] = layoutOptions[key]));
        }
        if (proxy.layoutOptions) {
            Object.assign(proxy.layoutOptions, toAssign);
        } else {
            proxy.layoutOptions = toAssign;
        }
        return builder;
    }
}
