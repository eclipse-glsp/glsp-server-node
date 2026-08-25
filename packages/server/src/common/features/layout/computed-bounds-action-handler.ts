/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
import {
    Action,
    ComputedBoundsAction,
    ElementAndAlignment,
    ElementAndBounds,
    ElementAndRoutingPoints,
    LayoutOperation,
    MaybePromise
} from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { applyAlignment, applyElementAndBounds, applyRoute } from '../../utils/layout-util';
import { Logger } from '../../utils/logger';
import { ModelState } from '../model/model-state';
import { ModelSubmissionHandler } from '../model/model-submission-handler';

/**
 * Syncs the bounds computed by the client (i.e. the actual bounds after applying CSS styles) back to the `GModel`.
 * In this default implementation the updated bounds are stored transient. This means they are applied to the graphical model but
 * are not persisted to the source model.
 */
@injectable()
export class ComputedBoundsActionHandler implements ActionHandler {
    @inject(ModelSubmissionHandler)
    protected submissionHandler: ModelSubmissionHandler;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(Logger)
    protected logger: Logger;

    actionKinds = [ComputedBoundsAction.KIND];
    execute(action: ComputedBoundsAction): MaybePromise<Action[]> {
        const model = this.modelState.root;
        if (action.revision === model.revision) {
            this.applyBounds(model, action);
            return this.submissionHandler.submitModelDirectly(
                undefined,
                LayoutOperation.create([], { canvasBounds: action.canvasBounds, viewport: action.viewport })
            );
        }

        return [];
    }

    /**
     * Applies everything the client computed for the given model.
     *
     * An entry that cannot be applied is skipped and logged rather than treated as an error.
     */
    protected applyBounds(root: GModelRoot, action: ComputedBoundsAction): void {
        this.applyElementBounds(action.bounds);
        this.applyAlignments(action.alignments ?? []);
        this.applyRoutes(action.routes ?? []);
    }

    protected applyElementBounds(allBounds: ElementAndBounds[]): void {
        const index = this.modelState.index;
        allBounds.forEach(bounds => {
            if (!applyElementAndBounds(bounds, index)) {
                this.logger.warn(`Skipped computed bounds of element '${bounds.elementId}'`);
            }
        });
    }

    protected applyAlignments(alignments: ElementAndAlignment[]): void {
        const index = this.modelState.index;
        alignments.forEach(alignment => {
            if (!applyAlignment(alignment, index)) {
                this.logger.warn(`Skipped computed alignment of element '${alignment.elementId}'`);
            }
        });
    }

    /**
     * Applies the computed routes.
     *
     * A skipped route is logged at debug level, an edge the client has not finished routing yet is expected.
     */
    protected applyRoutes(routes: ElementAndRoutingPoints[]): void {
        const index = this.modelState.index;
        routes.forEach(route => {
            if (!applyRoute(route, index)) {
                this.logger.debug(`Skipped computed route of element '${route.elementId}'`);
            }
        });
    }

    priority?: number | undefined;
}
