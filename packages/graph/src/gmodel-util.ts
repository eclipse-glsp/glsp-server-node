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

import { GModelElement, GModelElementConstructor } from './gmodel-element';

export type Predicate<T> = (element: T) => boolean;

/**
 * Returns the first element matching the search predicate starting from the given
 * element and walking up the parent hierarchy.
 *
 * @param element   The element to start the search from.
 * @param searchPredicate The predicate which the element should match.
 * @returns The first matching element or `undefined`.
 */
export function findParent(element: GModelElement, searchPredicate: Predicate<GModelElement>): GModelElement | undefined {
    if (!element) {
        return undefined;
    }
    if (searchPredicate(element)) {
        return element;
    }
    const parent = element.parent;
    return parent ? findParent(parent, searchPredicate) : undefined;
}

/**
 * Returns the first parent element that is an instance of the given {@link GModelElementConstructor} starting from the given element.
 * (recursively walking up the parent hierarchy).
 *
 * @param element   The element to start the search from.
 * @param constructor The queried parent class ({@link GModelElementConstructor}).
 * @returns The first matching parent element or `undefined`.
 */
export function findParentByClass<G extends GModelElement>(
    element: GModelElement,
    constructor: GModelElementConstructor<G>
): G | undefined {
    const predicate: Predicate<GModelElement> = element => element instanceof constructor;
    const result = findParent(element, predicate);
    if (result) {
        return result as G;
    }
    return undefined;
}
