/********************************************************************************
 * Copyright (c) 2022-2024 STMicroelectronics and others.
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
import { DefaultTypes as types } from '@eclipse-glsp/protocol';
import { GButton } from './gbutton';
import { GCompartment } from './gcompartment';
import { GEdge } from './gedge';
import { GGraph } from './ggraph';
import { GHtmlRoot } from './ghtml-root';
import { GIssueMarker } from './gissue-marker';
import { GLabel } from './glabel';
import { GModelElementConstructor } from './gmodel-element';
import { GNode } from './gnode';
import { GPort } from './gport';
import { GPreRenderedElement } from './gpre-rendered-element';
import { GShapedPreRenderedElement } from './gshaped-prerendered-element';

export function getDefaultMapping(): Map<string, GModelElementConstructor> {
    // The GModelSerializer (packages/server-node/src/features/model/gmodel-serializer.ts)
    // has a built-in subtype handling.
    // If the mapping for a subtype, e.g. for comp:header, is not found it will use the mapping for comp instead.
    const mapping = new Map<string, GModelElementConstructor>();
    mapping.set(types.GRAPH, GGraph);
    mapping.set(types.NODE, GNode);
    mapping.set(types.EDGE, GEdge);
    mapping.set(types.PORT, GPort);
    mapping.set(types.LABEL, GLabel);
    mapping.set(types.COMPARTMENT, GCompartment);
    mapping.set(types.BUTTON, GButton);
    mapping.set(types.ISSUE_MARKER, GIssueMarker);

    mapping.set(types.HTML, GHtmlRoot);
    mapping.set(types.PRE_RENDERED, GPreRenderedElement);
    mapping.set(types.FOREIGN_OBJECT, GShapedPreRenderedElement);
    return mapping;
}
