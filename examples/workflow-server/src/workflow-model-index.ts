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
import { GEdge, GModelIndex } from '@eclipse-glsp/server-node';
import { injectable } from 'inversify';
import { ModelTypes } from './util/model-types';

@injectable()
export class WorkflowModelIndex extends GModelIndex {
    getAllEdges(): GEdge[] {
        const edges: GEdge[] = super.getAllEdges();
        this.getElements(ModelTypes.WEIGHTED_EDGE).forEach(weighted => {
            if (weighted instanceof GEdge) {
                edges.push(weighted);
            }
        });
        return edges;
    }
}
