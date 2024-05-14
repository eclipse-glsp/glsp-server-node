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
import { GModelFactory, GModelSerializer } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { WorkflowModelState } from './workflow-model-state';

/**
 * This class provides the method to transform a source model into a GModel, updating the {@link GModelRoot}.
 *
 * This is, however, only relevant in cases where the source model is not already a valid GModel.
 *
 * Here, this custom implementation only serves to provide an entrypoint, but for a more extensive example
 * look to {@link https://eclipse.dev/glsp/documentation/gmodel/#graphical-model-factory}.
 */
@injectable()
export class WorkflowModelFactory implements GModelFactory {
    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(WorkflowModelState)
    protected modelState: WorkflowModelState;

    /**
     * Since this is an example using Workflow, which inherently already uses a GModel format, no difference
     * exists between the underlying source model and `root`. Therefore all handlers directly update the
     * root, making this method detrimental after first model creation.
     *
     * If other handlers are instead written to update `modelState.model`, then the root has to be updated
     * after every change.
     */
    createModel(): void {
        if (!this.modelState.root) {
            const root = this.modelSerializer.createRoot(this.modelState.model);
            this.modelState.updateRoot(root);
        }
    }
}
