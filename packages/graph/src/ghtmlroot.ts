/********************************************************************************
 * Copyright (c) 2022 StMicroelectronics.
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
import { DefaultTypes as types, flatPush, MaybeArray } from '@eclipse-glsp/protocol';
import { GModelRoot, GModelRootBuilder } from './gmodel-element';

/**
 * Root model element class for HTML content. Usually this is rendered with a `div` DOM element.
 */
export class GHtmlRoot extends GModelRoot {
    static override builder(): GHtmlRootBuilder {
        return new GHtmlRootBuilder(GHtmlRoot);
    }

    override type = types.HTML;
    classes: string[] = [];
}

export class GHtmlRootBuilder<G extends GHtmlRoot = GHtmlRoot> extends GModelRootBuilder<G> {
    addClasses(classes: string[]): this;
    addClasses(...classes: string[]): this;
    addClasses(...classes: MaybeArray<string>[]): this {
        flatPush(this.proxy.classes, classes);
        return this;
    }
}
