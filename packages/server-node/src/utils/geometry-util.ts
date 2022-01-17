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
import { GBoundsAware, GModelElement, GModelRoot, isGBoundsAware } from '@eclipse-glsp/graph';
import { ORIGIN_POINT, Point } from '@eclipse-glsp/protocol';

/**
 * Convert a point in absolute coordinates to a point relative to the specified GBoundsAware.
 * Note: this method only works if the specified {@link GBoundsAware} is part of a
 * hierarchy of {@link GBoundsAware}. If any of its parents (recursively) does not implement
 * {@link GBoundsAware}, this method will throw an exception.
 *
 * @param absolutePoint
 * @param modelElement
 * @returns
 *         A new point, relative to the coordinates space of the specified {@link GBoundsAware}
 * @throws Error if the modelElement is not part of a {@link GBoundsAware} hierarchy
 */
export function absoluteToRelative(absolutePoint: Point, modelElement: GModelElement & GBoundsAware): Point {
    let parentElement;
    if (!(modelElement instanceof GModelRoot)) {
        parentElement = modelElement.parent;
    }

    let relativeToParent: Point;
    if (!parentElement) {
        relativeToParent = { x: absolutePoint.x, y: absolutePoint.y };
    } else {
        if (!isGBoundsAware(parentElement)) {
            throw new Error(`The element is not part of a GBoundsAware hierarchy: ${modelElement}`);
        }
        relativeToParent = absoluteToRelative(absolutePoint, parentElement);
    }

    const x = modelElement.position?.x ?? 0;
    const y = modelElement.position?.y ?? 0;

    return { x: relativeToParent.x - x, y: relativeToParent.y - y };
}

export function shift(elements: GModelElement[], offset: Point): void {
    elements
        .filter(element => isGBoundsAware(element))
        .map(element => element as unknown as GBoundsAware)
        .forEach(gBoundsAware => {
            const position = gBoundsAware.position ?? ORIGIN_POINT;
            gBoundsAware.position = { x: position.x + offset.x, y: position.y + offset.y };
        });
}
