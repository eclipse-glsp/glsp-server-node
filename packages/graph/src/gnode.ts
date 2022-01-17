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
import { DefaultTypes } from '@eclipse-glsp/protocol';
import { GLayoutContainer, GLayoutContainerBuilder } from './glayout-container';
import { GShapeElement, GShapeElementBuilder } from './gshape-element';

export class GNode extends GShapeElement implements GLayoutContainer {
    static builder(): GNodeBuilder {
        return new GNodeBuilder(GNode).type(DefaultTypes.NODE);
    }

    type = DefaultTypes.NODE;
    layout?: string;
    [GLayoutContainer] = true;
}

export class GNodeBuilder<G extends GNode = GNode> extends GShapeElementBuilder<G> {
    layout(layout?: string): this {
        return GLayoutContainerBuilder.layout(this, layout);
    }
}
