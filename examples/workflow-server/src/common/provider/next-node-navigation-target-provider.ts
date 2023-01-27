/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
import { GEdge } from '@eclipse-glsp/graph';
import { TaskNode } from '../graph-extension';
import { AbstractNextOrPreviousNavigationTargetProvider } from './abstract-next-or-previous-navigation-target-provider';
import { injectable } from 'inversify';

@injectable()
export class NextNodeNavigationTargetProvider extends AbstractNextOrPreviousNavigationTargetProvider {
    targetTypeId = 'next';
    protected getEdges(taskNode: TaskNode): GEdge[] {
        return this.modelState.index.getOutgoingEdges(taskNode);
    }

    protected getSourceOrTarget(edge: GEdge): string {
        return edge.targetId;
    }
}
