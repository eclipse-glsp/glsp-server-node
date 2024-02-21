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
import { GAlignableBuilder, isGAlignable } from './galignable';
import { GLabel, GLabelBuilder } from './glabel';
import { GNode, GNodeBuilder } from './gnode';

describe('GAlignable Tests', () => {
    describe('isGAlignable function', () => {
        it('should return true for a GAlignable element', () => {
            const gLabelElement = new GLabelBuilder(GLabel) //
                .type(DefaultTypes.LABEL) //
                .build();

            const result = isGAlignable(gLabelElement);
            expect(result).to.be.true;
        });

        it('should return false for a non-GAlignable element', () => {
            const gNodeElement = new GNodeBuilder(GNode) //
                .position(100, 50) //
                .size(50, 15) //
                .type(DefaultTypes.NODE) //
                .build();

            const result = isGAlignable(gNodeElement);
            expect(result).to.be.false;
        });
    });

    describe('GAlignableBuilder alignment function', () => {
        it('should set alignment using a point object', () => {
            const builder = new GLabelBuilder(GLabel);
            GAlignableBuilder.alignment(builder, { x: 45, y: 90 });
            expect(builder['proxy'].alignment).to.deep.equal({ x: 45, y: 90 });
        });

        it('should set alignment using x and y parameters', () => {
            let builder = new GLabelBuilder(GLabel);
            GAlignableBuilder.alignment(builder, 8, 16);
            expect(builder['proxy'].alignment).to.deep.equal({ x: 8, y: 16 });

            builder = new GLabelBuilder(GLabel);
            GAlignableBuilder.alignment(builder, 12, 0);
            expect(builder['proxy'].alignment).to.deep.equal({ x: 12, y: 0 });
        });

        it('should set alignment from point object if y is provided too', () => {
            const builder = new GLabelBuilder(GLabel);
            GAlignableBuilder.alignment(builder, { x: 17, y: 71 }, 15);
            expect(builder['proxy'].alignment).to.deep.equal({ x: 17, y: 71 });
        });

        it('should default y to 0 if y is not provided', () => {
            const builder = new GLabelBuilder(GLabel);
            GAlignableBuilder.alignment(builder, 77);
            expect(builder['proxy'].alignment).to.deep.equal({ x: 77, y: 0 });
        });
    });
});
