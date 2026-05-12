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

import { GLabel, GModelElement } from '@eclipse-glsp/server';
import { DefaultMcpLabelProvider } from '@eclipse-glsp/server-mcp';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';

/**
 * Workflow-specific {@link DefaultMcpLabelProvider}: category labels are nested inside a
 * compartment-header child rather than directly under the category, so the default
 * direct-child lookup misses them. Other workflow element types fall through to the
 * inherited default.
 */
@injectable()
export class WorkflowMcpLabelProvider extends DefaultMcpLabelProvider {
    override getLabel(element: GModelElement): GLabel | undefined {
        if (element.type === ModelTypes.CATEGORY) {
            const header = element.children.find(child => child.type === ModelTypes.COMP_HEADER);
            return header?.children.find((child): child is GLabel => child instanceof GLabel);
        }
        return super.getLabel(element);
    }
}
