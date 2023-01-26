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
import { MaybePromise, RequestModelAction, SaveModelAction, TypeGuard } from '@eclipse-glsp/protocol';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import { fileURLToPath } from 'url';
import { ModelState, SOURCE_URI_ARG } from '../common/features/model/model-state';
import { SourceModelStorage } from '../common/features/model/source-model-storage';
import { GLSPServerError } from '../common/utils/glsp-server-error';

/**
 * An abstract implementation of {@link SourceModelStorage} that provides utility methods for loading and saving JSON source models
 * from/into a file.
 */
@injectable()
export abstract class AbstractJsonModelStorage implements SourceModelStorage {
    @inject(ModelState)
    protected modelState: ModelState;

    abstract loadSourceModel(action: RequestModelAction): MaybePromise<void>;

    abstract saveSourceModel(action: SaveModelAction): MaybePromise<void>;

    protected getSourceUri(action: RequestModelAction): string {
        const sourceUri = action.options?.[SOURCE_URI_ARG];
        if (typeof sourceUri !== 'string') {
            throw new GLSPServerError(`Invalid RequestModelAction! Missing argument with key '${SOURCE_URI_ARG}'`);
        }
        return sourceUri;
    }

    protected loadFromFile(sourceUri: string): unknown;
    protected loadFromFile<T>(sourceUri: string, guard: TypeGuard<T>): T;
    protected loadFromFile<T>(sourceUri: string, guard?: TypeGuard<T>): T | unknown {
        try {
            const path = this.toPath(sourceUri);
            let fileContent = this.readFile(path);
            if (!fileContent) {
                fileContent = this.createModelForEmptyFile(path);
                if (!fileContent) {
                    throw new GLSPServerError(`Could not load the source model. The file '${path}' is empty!.`);
                }
            }
            if (guard && !guard(fileContent)) {
                throw new Error('The loaded root object is not of the expected type!');
            }
            return fileContent;
        } catch (error) {
            throw new GLSPServerError(`Could not load model from file: ${sourceUri}`, error);
        }
    }

    /**
     * Can be overwritten to customize the behavior if the given file path points to an empty file.
     * The default implementation returns undefined, concrete subclasses can customize this behavior and
     * return new source model object instead.
     * @param path The path of the empty file.
     * @returns The new model or `undefined`
     */
    protected createModelForEmptyFile(path: string): unknown | undefined {
        return undefined;
    }

    protected readFile(path: string): unknown | undefined {
        try {
            const data = fs.readFileSync(path, { encoding: 'utf8' });
            if (!data || data.length === 0) {
                return undefined;
            }
            return this.toJson(data);
        } catch (error) {
            throw new GLSPServerError(`Could not read & parse file contents of '${path}' as json`, error);
        }
    }

    protected toJson(fileContent: string): unknown {
        return JSON.parse(fileContent);
    }

    protected toPath(sourceUri: string): string {
        return sourceUri.startsWith('file://') ? fileURLToPath(sourceUri) : sourceUri;
    }

    protected getFileUri(action: SaveModelAction): string {
        const uri = action.fileUri ?? this.modelState.get(SOURCE_URI_ARG);
        if (!uri) {
            throw new GLSPServerError('Could not derive fileUri for saving the current source model');
        }
        return uri;
    }

    protected writeFile(fileUri: string, model: unknown): void {
        const path = this.toPath(fileUri);
        const content = this.toString(model);
        fs.writeFileSync(path, content);
    }

    protected toString(model: unknown): string {
        return JSON.stringify(model, undefined, 2);
    }
}
