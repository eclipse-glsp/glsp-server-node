/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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

import { GAlignable, GBoundsAware, GEdge, GGraph, GModelElement, GModelRoot, isGAlignable, isGBoundsAware } from '@eclipse-glsp/graph';
import { ElementAndAlignment, ElementAndBounds, ElementAndRoutingPoints, Point } from '@eclipse-glsp/protocol';
import { GModelIndex } from '../features/model/gmodel-index';
import { ArgsUtil } from './args-util';
import { GLSPServerError, getOrThrow } from './glsp-server-error';

/**
 * Applies the new bounds to the model.
 *
 * @param bounds The new bounds.
 * @param index  The model index.
 * @returns The changed element.
 */
export function applyElementAndBounds(bounds: ElementAndBounds, index: GModelIndex): GBoundsAware | undefined {
    const element = getOrThrow(index.get(bounds.elementId), 'Model element not found! ID: ' + bounds.elementId);
    if (isGBoundsAware(element)) {
        if (bounds.newPosition !== undefined) {
            element.position = bounds.newPosition;
        }
        element.size = bounds.newSize;
        return element;
    }
    return undefined;
}

/**
 * Applies the new alignment to the model.
 *
 * @param alignment The new alignment.
 * @param index     The model index.
 * @returns The changed element.
 */
export function applyAlignment(alignment: ElementAndAlignment, index: GModelIndex): GAlignable | undefined {
    const element = getOrThrow(index.get(alignment.elementId), 'Model element not found! ID: ' + alignment.elementId);
    if (isGAlignable(element)) {
        element.alignment = alignment.newAlignment;
        return element;
    }
    return undefined;
}

/**
 * Applies the new route to the model.
 *
 * @param route The new route.
 * @param index The model index.
 * @returns The changed element.
 */
export function applyRoute(route: ElementAndRoutingPoints, index: GModelIndex): GEdge {
    const routingPoints = route.newRoutingPoints ?? [];
    if (routingPoints.length < 2) {
        throw new GLSPServerError('Invalid Route!');
    }
    // first and last point mark the source and target point
    const edge = applyRoutingPoints(route, index);
    const edgeRoutingPoints = edge.routingPoints;

    const args = edge.args ?? {};
    const source = edgeRoutingPoints.shift()!;
    const target = edgeRoutingPoints.pop()!;
    args[ArgsUtil.KEY_EDGE_SOURCE_POINT_X] = source.x;
    args[ArgsUtil.KEY_EDGE_SOURCE_POINT_Y] = source.y;
    args[ArgsUtil.KEY_EDGE_TARGET_POINT_X] = target.x;
    args[ArgsUtil.KEY_EDGE_TARGET_POINT_Y] = target.y;
    if (!edge.args) {
        edge.args = args;
    }
    return edge;
}

/**
 * Returns the complete route of the given edge. The route, as opposed to the routing points, also contain the source
 * and target point.
 *
 * @param edge The edge from which we get the route
 * @returns complete edge route
 */
export function getRoute(edge: GEdge): ElementAndRoutingPoints {
    const sourcePoint = ArgsUtil.getEdgeSourcePoint(edge.args);
    if (!sourcePoint) {
        throw new GLSPServerError('Cannot get route without source point!');
    }
    const targetPoint = ArgsUtil.getEdgeTargetPoint(edge.args);
    if (!targetPoint) {
        throw new GLSPServerError('Cannot get route without target point!');
    }
    const route: Point[] = [];
    route.push(sourcePoint);
    route.push(...edge.routingPoints);
    route.push(targetPoint);
    return { elementId: edge.id, newRoutingPoints: route };
}

export function applyRoutingPoints(routingPoints: ElementAndRoutingPoints, index: GModelIndex): GEdge {
    const edge = getOrThrow(index.findByClass(routingPoints.elementId, GEdge), 'Model element not found! ID: ' + routingPoints.elementId);
    edge.routingPoints = routingPoints.newRoutingPoints ?? [];
    return edge;
}
/**
 * Returns the relative location of the given absolute location within the container.
 *
 * @param absoluteLocation absolute location
 * @param container        container
 * @return relative location if it can be determined, absolute location in case of error and null if the container
 *         cannot contain any location.
 */
export function getRelativeLocation(absoluteLocation: Point, container: GModelElement): Point | undefined {
    const allowNegativeCoordinates = container instanceof GGraph;
    if (isGBoundsAware(container)) {
        const relativePosition = absoluteToRelative(absoluteLocation, container);
        const relativeLocation = allowNegativeCoordinates
            ? relativePosition
            : { x: Math.max(0, relativePosition.x), y: Math.max(0, relativePosition.y) };
        return relativeLocation;
    }
    return undefined;
}

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
