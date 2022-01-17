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
import { Args, DefaultTypes, JsonPrimitive } from '@eclipse-glsp/protocol';
import { GLayoutContainer, GLayoutContainerBuilder } from './glayout-container';
import { GLayoutable, GLayoutableBuilder } from './glayoutable';
import { GShapeElement, GShapeElementBuilder } from './gshape-element';

export class GCompartment extends GShapeElement implements GLayoutContainer, GLayoutable {
    static builder(): GCompartmentBuilder {
        return new GCompartmentBuilder(GCompartment).type(DefaultTypes.COMPARTMENT);
    }

    type = DefaultTypes.COMPARTMENT;
    layout?: string;
    layoutOptions?: Args;
    [GLayoutContainer] = true;
    [GLayoutable] = true;
}

export class GCompartmentBuilder<G extends GCompartment = GCompartment> extends GShapeElementBuilder<G> {
    layout(layout?: string): this {
        return GLayoutContainerBuilder.layout(this, layout);
    }

    addLayoutOption(key: string, value: JsonPrimitive): this {
        return GLayoutableBuilder.addLayoutOption(this, key, value);
    }

    addLayoutOptions(layoutOptions: Args): this;
    addLayoutOptions(layoutOptions: Map<string, JsonPrimitive>): this;
    addLayoutOptions(layoutOptions: Args | Map<string, JsonPrimitive>): this {
        return GLayoutableBuilder.addLayoutOptions(this, layoutOptions);
    }
}
