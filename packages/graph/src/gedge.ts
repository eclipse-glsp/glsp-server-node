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
import { DefaultTypes, flatPush, MaybeArray, Point } from '@eclipse-glsp/protocol';
import { GModelElement, GModelElementBuilder } from './gmodel-element';

export class GEdge extends GModelElement {
    static builder(): GEdgeBuilder {
        return new GEdgeBuilder(GEdge).type(DefaultTypes.EDGE);
    }

    type = DefaultTypes.EDGE;
    routingPoints: Point[] = [];
    sourceId: string;
    targetId: string;
    routerKind?: string;
}

export namespace GEdge {
    export function is(object: unknown): object is GEdge {
        return GEdge.is(object);
    }
}

export class GEdgeBuilder<G extends GEdge = GEdge> extends GModelElementBuilder<G> {
    source(source: GModelElement): this {
        this.proxy.sourceId = source.id;
        return this;
    }

    sourceId(sourceId: string): this {
        this.proxy.sourceId = sourceId;
        return this;
    }

    target(target: GModelElement): this {
        this.proxy.targetId = target.id;
        return this;
    }

    targetId(targetId: string): this {
        this.proxy.targetId = targetId;
        return this;
    }

    routerKind(routerKind: string): this {
        this.proxy.routerKind = routerKind;
        return this;
    }

    addRoutingPoint(x: number, y: number): this;
    addRoutingPoint(point: Point): this;
    addRoutingPoint(xOrPoint: Point | number, y?: number): this {
        if (typeof xOrPoint === 'object') {
            this.proxy.routingPoints.push(xOrPoint);
        } else if (y) {
            this.proxy.routingPoints.push({ x: xOrPoint, y });
        }
        return this;
    }

    addRoutingPoints(routingPoints: Point[]): this;
    addRoutingPoints(...routingPoints: Point[]): this;
    addRoutingPoints(...routingPoints: MaybeArray<Point>[]): this {
        flatPush(this.proxy.routingPoints, routingPoints);
        return this;
    }
}
