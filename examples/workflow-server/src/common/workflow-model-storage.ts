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
import {
    GModelElementSchema,
    GModelSerializer,
    MaybePromise,
    RequestModelAction,
    SaveModelAction,
    SourceModelStorage
} from '@eclipse-glsp/server';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import { WorkflowModelState } from './workflow-model-state';

/**
 * This {@link SourceModelStorage} serves as a naive implementation similar to the default {@link GModelStorage}.
 * The main difference being that the source model is not directly instantiated as GModel, which works
 * in the Workflow example (since its data format is already a valid GModel), but not generally. Therefore,
 * this example is more easily applicable to custom model formats.
 *
 * The model saved here is later on transformed in {@link WorkflowModelFactory} and has to be updated in the handlers,
 * if source model and GModel are different.
 */
@injectable()
export class WorkflowSourceModelStorage implements SourceModelStorage {
    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(WorkflowModelState)
    protected modelState: WorkflowModelState;

    loadSourceModel(action: RequestModelAction): MaybePromise<void> {
        const sourceUri = action.options!['sourceUri'] as string;
        const model = this.loadJsonFile(sourceUri);
        this.modelState.model = model;
        this.modelState.set('sourceUri', sourceUri);
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        const fileUri = this.modelState.get('sourceUri') as string;
        const schema = this.modelSerializer.createSchema(this.modelState.root);
        fs.writeFileSync(fileUri, JSON.stringify(schema));
    }

    protected loadJsonFile(path: string): GModelElementSchema {
        if (os.platform() === 'win32') {
            path = path.replace(/^\//, '');
        }
        const data = fs.readFileSync(path, { encoding: 'utf8' });
        return JSON.parse(data);
    }
}
