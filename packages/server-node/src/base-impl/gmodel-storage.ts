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
import { GGraph, GModelElementSchema, GModelRoot } from '@eclipse-glsp/graph';
import { MaybePromise, RequestModelAction, SaveModelAction } from '@eclipse-glsp/protocol';
import { writeFileSync } from 'fs';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import { fileURLToPath } from 'url';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { SourceModelStorage } from '../features/model/source-model-storage';
import { getOrThrow, GLSPServerError } from '../utils/glsp-server-error';
import { Logger } from '../utils/logger';
import { GModelState } from './gmodel-state';

export const EMPTY_ROOT = GGraph.builder().id('empty').build();

/**
 * A {@link SourceModelStorage} that reads and writes the graph model directly from / into
 * a JSON file and uses it as source model.
 */
@injectable()
export class GModelStorage implements SourceModelStorage {
    @inject(Logger)
    protected logger: Logger;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(GModelState)
    protected modelState: GModelState;

    loadSourceModel(action: RequestModelAction): MaybePromise<void> {
        const sourceUri = getOrThrow(
            this.modelState.sourceUri,
            `Invalid RequestModelAction! Missing argument with key '${GModelState.SOURCE_URI}'`
        );
        const root = this.loadFromFile(sourceUri);
        root.revision = -1;
        this.modelState.root = root;
    }

    protected loadFromFile(sourceUri: string): GModelRoot {
        try {
            const path = this.isFileUrl(sourceUri) ? fileURLToPath(sourceUri) : sourceUri;
            const fileContent = this.readFile(path);
            if (!fileContent) {
                return EMPTY_ROOT;
            }
            if (!GModelElementSchema.is(fileContent)) {
                throw new Error('The loaded root object is not of type SModelRootSchema');
            }
            return this.modelSerializer.createRoot(fileContent);
        } catch (error) {
            throw new GLSPServerError(`Could not load model from file: ${sourceUri}`, error);
        }
    }

    protected isFileUrl(sourceUri: string): boolean {
        return sourceUri.startsWith('file://');
    }

    protected readFile(url: string): unknown {
        try {
            const data = fs.readFileSync(url, { encoding: 'utf8' });
            return JSON.parse(data);
        } catch (error) {
            throw new GLSPServerError(`Could not read & parse file contents of '${url}' as json`, error);
        }
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        try {
            const data = this.modelSerializer.createSchema(this.modelState.root);
            writeFileSync(this.modelState.sourceUri!, JSON.stringify(data, undefined, 2));
        } catch (error) {
            throw new GLSPServerError(`Could not load model from file: ${this.modelState.sourceUri}`, error);
        }
    }
}
