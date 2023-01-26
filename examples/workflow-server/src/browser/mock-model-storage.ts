/********************************************************************************
 * Copyright (c) 2022-2023 EclipseSource and others.
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
    GModelSerializer,
    Logger,
    MaybePromise,
    ModelState,
    RequestModelAction,
    SaveModelAction,
    SourceModelStorage
} from '@eclipse-glsp/server/browser';
import { inject, injectable } from 'inversify';
import wf from './example1.json';

@injectable()
export class WorkflowMockModelStorage implements SourceModelStorage {
    @inject(Logger)
    protected logger: Logger;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(ModelState)
    protected modelState: ModelState;

    loadSourceModel(action: RequestModelAction): MaybePromise<void> {
        const root = this.modelSerializer.createRoot(wf);
        this.modelState.updateRoot(root);
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        this.logger.warn('Saving is not supported by this mock implementation');
    }
}
