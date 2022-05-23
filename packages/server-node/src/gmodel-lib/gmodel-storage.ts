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
import { GGraph, GModelElementSchema } from '@eclipse-glsp/graph';
import { MaybePromise, RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { AbstractJsonModelStorage } from '../features/model/abstract-json-model-storage';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelState } from '../features/model/model-state';
import { Logger } from '../utils/logger';

export const EMPTY_ROOT = GGraph.builder().id('empty').build();

/**
 * A {@link SourceModelStorage} that reads and writes the graph model directly from / into
 * a JSON file and uses it as source model.
 */
@injectable()
export class GModelStorage extends AbstractJsonModelStorage {
    @inject(Logger)
    protected logger: Logger;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(ModelState)
    protected override modelState: ModelState;

    loadSourceModel(action: RequestModelAction): MaybePromise<void> {
        const sourceUri = this.getSourceUri(action);
        const rootSchema = this.loadFromFile(sourceUri, GModelElementSchema.is);
        const root = this.modelSerializer.createRoot(rootSchema);
        this.modelState.updateRoot(root);
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        const fileUri = this.getFileUri(action);
        const schema = this.modelSerializer.createSchema(this.modelState.root);
        this.writeFile(fileUri, schema);
    }
}
