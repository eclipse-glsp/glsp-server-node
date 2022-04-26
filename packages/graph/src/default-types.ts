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
import { DefaultTypes as types } from '@eclipse-glsp/protocol';
import { GButton } from './gbutton';
import { GCompartment } from './gcompartment';
import { GEdge } from './gedge';
import { GGraph } from './ggraph';
import { GIssueMarker } from './gissue-marker';
import { GLabel } from './glabel';
import { GModelElementConstructor, GModelRoot } from './gmodel-element';
import { GNode } from './gnode';
import { GPort } from './gport';
import { GPreRenderedElement } from './gpre-rendered-element';
import { GShapePreRenderedElement } from './gpre-shape-prerendered-element';

export function getDefaultMapping(): Map<string, GModelElementConstructor> {
    const mapping = new Map<string, GModelElementConstructor>();
    mapping.set(types.GRAPH, GGraph);
    mapping.set(types.NODE, GNode);
    mapping.set(types.EDGE, GEdge);
    mapping.set(types.PORT, GPort);
    mapping.set(types.LABEL, GLabel);
    mapping.set(types.COMPARTMENT, GCompartment);
    mapping.set(types.BUTTON, GButton);
    mapping.set(types.ISSUE_MARKER, GIssueMarker);

    mapping.set(types.HTML, GModelRoot);
    mapping.set(types.PRE_RENDERED, GPreRenderedElement);
    mapping.set(types.FOREIGN_OBJECT, GShapePreRenderedElement);
    return mapping;
}
