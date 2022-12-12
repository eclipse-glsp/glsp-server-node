/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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

import { GModelRootSchema } from '@eclipse-glsp/graph';
import { Operation, SModelRootSchema } from '@eclipse-glsp/protocol';
import * as jsonPatch from 'fast-json-patch';
import { inject, injectable } from 'inversify';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelState } from '../features/model/model-state';
import { Command } from '../features/undo-redo/command';
import { AbstractRecordingCommand } from '../features/undo-redo/recording-command';
import { OperationActionHandler } from '../operations/operation-action-handler';
import { OperationHandler } from '../operations/operation-handler';

@injectable()
export class GModelOperationActionHandler extends OperationActionHandler {
    @inject(GModelSerializer)
    protected serializer: GModelSerializer;

    protected override createCommand(operation: Operation, handler: OperationHandler): Command {
        return new GModelRecordingCommand(this.modelState, this.serializer, () => handler.execute(operation));
    }
}

export class GModelRecordingCommand extends AbstractRecordingCommand<GModelRootSchema> {
    constructor(protected modelState: ModelState, protected serializer: GModelSerializer, protected doExecute: () => void) {
        super();
    }

    override execute(): void {
        super.execute();
        this.modelState.index.indexRoot(this.modelState.root);
    }

    protected getJsonObject(): GModelRootSchema {
        return this.serializer.createSchema(this.modelState.root);
    }

    protected override applyPatch(rootSchema: SModelRootSchema, patch: jsonPatch.Operation[]): void {
        super.applyPatch(rootSchema, patch);
        const newRoot = this.serializer.createRoot(rootSchema);
        this.modelState.updateRoot(newRoot);
    }
}
