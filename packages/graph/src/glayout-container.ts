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
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export const GLayoutContainer = Symbol('GLayoutContainer');

export interface GLayoutContainer {
    layout?: string;
    [GLayoutContainer]: boolean;
}

export function isGLayoutContainer<G extends GModelElement>(element: G): element is G & GLayoutContainer {
    return ((element as any)[GLayoutContainer] = true);
}

export type GLayoutContainerBuilder = GModelElementBuilder<GModelElement & GLayoutContainer>;

export namespace GLayoutContainerBuilder {
    export function layout<B extends GLayoutContainerBuilder>(builder: B, newLayout?: string): B {
        builder['proxy'].layout = newLayout;
        return builder;
    }
}
