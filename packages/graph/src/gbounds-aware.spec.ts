/********************************************************************************
 * Copyright (c) 2024 EclipseSource and others.
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
import { DefaultTypes } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { GBoundsAwareBuilder, isGBoundsAware } from './gbounds-aware';
import { GEdge, GEdgeBuilder } from './gedge';
import { GNode, GNodeBuilder } from './gnode';
import { GShapeElementBuilder } from './gshape-element';

describe('GBoundsAware Tests', () => {
    describe('isGBoundsAware function', () => {
        it('should return true for a GBoundsAware element', () => {
            const gNodeElement = new GNodeBuilder(GNode) //
                .position(100, 50) //
                .size(50, 15) //
                .type(DefaultTypes.NODE) //
                .build();

            const result = isGBoundsAware(gNodeElement);
            expect(result).to.be.true;
        });

        it('should return false for a non-GBoundsAware element', () => {
            const gEdgeElement = new GEdgeBuilder(GEdge) //
                .type(DefaultTypes.EDGE) //
                .build();

            const result = isGBoundsAware(gEdgeElement);
            expect(result).to.be.false;
        });
    });

    describe('GBoundsAwareBuilder position function', () => {
        it('should set position using a point object', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.position(builder, { x: 5, y: 10 });
            expect(builder['proxy'].position).to.deep.equal({ x: 5, y: 10 });
        });

        it('should set position using x and y parameters', () => {
            let builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.position(builder, 5, 10);
            expect(builder['proxy'].position).to.deep.equal({ x: 5, y: 10 });

            builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.position(builder, 5, 0);
            expect(builder['proxy'].position).to.deep.equal({ x: 5, y: 0 });
        });

        it('should set position from point object if y is provided too', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.position(builder, { x: 17, y: 71 }, 15);
            expect(builder['proxy'].position).to.deep.equal({ x: 17, y: 71 });
        });

        it('should default y to 0 if y is not provided', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.position(builder, 35);
            expect(builder['proxy'].position).to.deep.equal({ x: 35, y: 0 });
        });
    });

    describe('GBoundsAwareBuilder size function', () => {
        it('should set size using a dimension object', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.size(builder, { width: 55, height: 15 });
            expect(builder['proxy'].size).to.deep.equal({ width: 55, height: 15 });
        });

        it('should set size using width and height parameters', () => {
            let builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.size(builder, 50, 35);
            expect(builder['proxy'].size).to.deep.equal({ width: 50, height: 35 });

            builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.size(builder, 70, 0);
            expect(builder['proxy'].size).to.deep.equal({ width: 70, height: 0 });
        });

        it('should set size from dimension object if height is provided too', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.size(builder, { width: 11, height: 33 }, 15);
            expect(builder['proxy'].size).to.deep.equal({ width: 11, height: 33 });
        });

        it('should default height to 0 if height is not provided', () => {
            const builder = new GShapeElementBuilder(GNode);
            GBoundsAwareBuilder.size(builder, 60);
            expect(builder['proxy'].size).to.deep.equal({ width: 60, height: 0 });
        });
    });
});
