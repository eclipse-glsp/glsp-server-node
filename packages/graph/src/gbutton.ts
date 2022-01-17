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
import { GModelElementConstructor } from './gmodel-element';
import { GShapeElement, GShapeElementBuilder } from './gshape-element';

export class GButton extends GShapeElement {
    static builder<G extends GButton = GButton>(constructor?: GModelElementConstructor<G>): GButtonBuilder {
        return new GButtonBuilder(constructor ?? GButton).type(DefaultTypes.BUTTON_EXPAND);
    }

    type = DefaultTypes.BUTTON_EXPAND;
    enabled = true;
}

export class GButtonBuilder<G extends GButton = GButton> extends GShapeElementBuilder<G> {
    enabled(enabled: boolean): this {
        this.proxy.enabled = enabled;
        return this;
    }
}
