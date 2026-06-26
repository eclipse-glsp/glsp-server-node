/********************************************************************************
 * Copyright (c) 2022-2026 EclipseSource and others.
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
    GLSPServerError,
    GModelSerializer,
    Logger,
    MaybePromise,
    ModelState,
    RequestModelAction,
    SaveModelAction,
    SourceModelStorage
} from '@eclipse-glsp/server/browser';
import { inject, injectable } from 'inversify';

/**
 * Read-only source model storage for the web worker server.
 *
 * A worker has no filesystem, so instead of reading from disk it `fetch`es the diagram file the
 * client points it at via `RequestModelAction.options.sourceUri`. The client sends an absolute URL
 * (it is the only party that knows where the app is served from), so this storage just GETs it and
 * deserializes the GModel JSON — `.wf`/`.gm`/`.json` are all the same serialized format, which keeps
 * the storage language-agnostic (workflow-diagram and gmodel-demo share it). Saving is unsupported.
 */
@injectable()
export class WebModelStorage implements SourceModelStorage {
    @inject(Logger)
    protected logger: Logger;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(ModelState)
    protected modelState: ModelState;

    async loadSourceModel(action: RequestModelAction): Promise<void> {
        const sourceUri = action.options?.sourceUri;
        if (typeof sourceUri !== 'string') {
            throw new GLSPServerError('No sourceUri provided to load the source model from');
        }
        const response = await fetch(sourceUri);
        if (!response.ok) {
            throw new GLSPServerError(`Could not load model from '${sourceUri}': ${response.status} ${response.statusText}`);
        }
        const root = this.modelSerializer.createRoot(await response.json());
        this.modelState.updateRoot(root);
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        this.logger.warn('Saving is not supported by the read-only web worker storage');
    }
}
