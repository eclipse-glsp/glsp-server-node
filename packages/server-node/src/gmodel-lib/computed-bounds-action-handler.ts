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
import { GModelRoot } from '@eclipse-glsp/graph';
import { Action, ComputedBoundsAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { ModelState } from '../features/model/model-state';
import { ModelSubmissionHandler } from '../features/model/model-submission-handler';
import { applyAlignment, applyBounds, applyRoute } from '../utils/layout-util';

@injectable()
export class ComputedBoundsActionHandler implements ActionHandler {
    @inject(ModelSubmissionHandler)
    protected submissionHandler: ModelSubmissionHandler;

    @inject(ModelState)
    protected modelState: ModelState;

    actionKinds = [ComputedBoundsAction.KIND];
    execute(action: ComputedBoundsAction): Action[] {
        const model = this.modelState.root;
        if (action.revision === model.revision) {
            this.applyBounds(model, action);
            return this.submissionHandler.submitModelDirectly();
        }

        return [];
    }

    protected applyBounds(root: GModelRoot, action: ComputedBoundsAction): void {
        const index = this.modelState.index;
        action.bounds.forEach(bounds => applyBounds(bounds, index));
        (action.alignments ?? []).forEach(alignment => applyAlignment(alignment, index));
        (action.routes ?? []).forEach(route => applyRoute(route, index));
    }

    priority?: number | undefined;
}
