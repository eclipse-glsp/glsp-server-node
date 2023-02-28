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

import { GModelRootSchema } from '@eclipse-glsp/graph';
import { AnyObject, MaybePromise } from '@eclipse-glsp/protocol';
import * as jsonPatch from 'fast-json-patch';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelState } from '../features/model/model-state';
import { Command } from './command';
/**
 * An abstract implementation for {@link Command} that should records changes made to a JSON object during execution.
 * These changes are recorded in the form of json patches.
 */
export abstract class AbstractRecordingCommand<JsonObject extends AnyObject> implements Command {
    protected undoPatch?: jsonPatch.Operation[];
    protected redoPatch?: jsonPatch.Operation[];

    async execute(): Promise<void> {
        const beforeState = this.deepClone(this.getJsonObject());
        await this.doExecute();
        const afterState = this.getJsonObject();
        this.undoPatch = jsonPatch.compare(afterState, beforeState);
        this.redoPatch = jsonPatch.compare(beforeState, afterState);
    }

    /**
     * Retrieves the current state of the JSON object. Is called right before and
     * right after {@link AbstractRecordingCommand.doExecute} to derive the undo & redo patches.
     * @returns The current state of the JSON object
     */
    protected abstract getJsonObject(): JsonObject;

    /**
     * The actual execution i.e. series of changes applied to the JSOn object that should be captured.
     */
    protected abstract doExecute(): MaybePromise<void>;

    protected applyPatch(object: JsonObject, patch: jsonPatch.Operation[]): void {
        jsonPatch.applyPatch(object, patch, false, true);
    }

    /**
     * Captures the original state of the JSON object before executing the command routine.
     * This implementation cannot clone circular structures as it relies on `JSON.stringify`.
     * @param object The object that should be cloned
     * @returns A deep clone of the given object
     */
    protected deepClone(object: JsonObject): JsonObject {
        return jsonPatch.deepClone(object);
    }

    undo(): void {
        if (this.undoPatch) {
            this.applyPatch(this.getJsonObject(), this.undoPatch);
        }
    }

    redo(): void {
        if (this.redoPatch) {
            this.applyPatch(this.getJsonObject(), this.redoPatch);
        }
    }

    canUndo(): boolean {
        return !!this.undoPatch && !!this.redoPatch;
    }
}

/**
 * Simple base implementation of {@link AbstractRecordingCommand} that records the changes made to the given JSON object during
 * the the given `doExecute` function.
 */
export class RecordingCommand<JsonObject extends AnyObject = AnyObject> extends AbstractRecordingCommand<JsonObject> {
    constructor(protected jsonObject: JsonObject, protected doExecute: () => MaybePromise<void>) {
        super();
    }

    protected getJsonObject(): JsonObject {
        return this.jsonObject;
    }
}

/**
 * Simple base implementation of {@link AbstractRecordingCommand} that allows recording of changes made
 * to the `GModelRoot` ({@link ModelState.root}) during the given `doExecute` function
 */
export class GModelRecordingCommand extends AbstractRecordingCommand<GModelRootSchema> {
    constructor(protected modelState: ModelState, protected serializer: GModelSerializer, protected doExecute: () => MaybePromise<void>) {
        super();
    }

    override async execute(): Promise<void> {
        await super.execute();
        this.modelState.index.indexRoot(this.modelState.root);
    }

    protected getJsonObject(): GModelRootSchema {
        return this.serializer.createSchema(this.modelState.root);
    }

    protected override applyPatch(rootSchema: GModelRootSchema, patch: jsonPatch.Operation[]): void {
        super.applyPatch(rootSchema, patch);
        const newRoot = this.serializer.createRoot(rootSchema);
        this.modelState.updateRoot(newRoot);
    }
}
