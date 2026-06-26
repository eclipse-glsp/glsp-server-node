/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import {
    DiagramConfiguration,
    EdgeTypeHint,
    GModelElementConstructor,
    ServerLayoutKind,
    ShapeTypeHint,
    getDefaultMapping
} from '@eclipse-glsp/server';
import { injectable } from 'inversify';

/**
 * Diagram configuration for the `gmodel-demo` example language.
 *
 * `.gm` files are a serialized form of the direct GModel using only default
 * primitives (`GNode`, `GEdge`, `GLabel`, `GPort`, `GCompartment`, ...), so the
 * default type mapping is sufficient and no custom types, views or operation
 * handlers are required.
 *
 * The language is load-and-interact only: no shape or edge type hints are
 * declared, so the client offers no element-creation tools. Selecting, moving
 * and navigating the predefined elements stays available through their model
 * features.
 */
@injectable()
export class GModelDemoDiagramConfiguration implements DiagramConfiguration {
    get typeMapping(): Map<string, GModelElementConstructor> {
        return getDefaultMapping();
    }

    readonly shapeTypeHints: ShapeTypeHint[] = [];
    readonly edgeTypeHints: EdgeTypeHint[] = [];

    layoutKind = ServerLayoutKind.MANUAL;
    needsClientLayout = true;
    animatedUpdate = true;
}
