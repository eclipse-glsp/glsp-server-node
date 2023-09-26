/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { Action, CheckEdgeResultAction, MaybePromise, RequestCheckEdgeAction } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { DiagramConfiguration } from '../../diagram/diagram-configuration';
import { GLSPServerError, getOrThrow } from '../../utils/glsp-server-error';
import { ModelState } from '../model/model-state';
import { EdgeCreationChecker } from './edge-creation-checker';

@injectable()
export class RequestCheckEdgeActionHandler implements ActionHandler {
    @inject(ModelState)
    protected modelState: ModelState;

    @inject(DiagramConfiguration)
    protected diagramConfiguration: DiagramConfiguration;

    @inject(EdgeCreationChecker)
    @optional()
    protected edgeCreationChecker?: EdgeCreationChecker;

    readonly actionKinds: string[] = [RequestCheckEdgeAction.KIND];

    execute(action: RequestCheckEdgeAction): MaybePromise<Action[]> {
        const hasDynamicHint = this.diagramConfiguration.edgeTypeHints.some(hint => hint.elementTypeId === action.edgeType && hint.dynamic);
        const { edgeType, sourceElementId, targetElementId } = action;
        const isValid = this.edgeCreationChecker && hasDynamicHint ? this.validate(action) : true;

        return [CheckEdgeResultAction.create({ edgeType, isValid, sourceElementId, targetElementId })];
    }

    protected validate(action: RequestCheckEdgeAction): boolean {
        const sourceElement = getOrThrow(
            this.modelState.index.get(action.sourceElementId),
            'Invalid `RequestCheckEdgeTargetAction`!. Could not find a source element with id: ' + action.sourceElementId
        );
        const targetElement = action.targetElementId ? this.modelState.index.get(action.targetElementId) : undefined;

        if (action.targetElementId && !targetElement) {
            throw new GLSPServerError(
                'Invalid `RequestCheckEdgeTargetAction`! Could not find a target element with id: ' + action.targetElementId
            );
        }
        return targetElement
            ? this.edgeCreationChecker!.isValidTarget(action.edgeType, sourceElement, targetElement)
            : this.edgeCreationChecker!.isValidSource(action.edgeType, sourceElement);
    }
}
