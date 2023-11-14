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

import { AnyObject, GModelElementSchema, GModelRootSchema, MaybePromise } from '@eclipse-glsp/protocol';
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
        const beforeState = this.deepClone(await this.getJsonObject());
        await this.doExecute();
        const afterState = await this.getJsonObject();
        this.undoPatch = jsonPatch.compare(afterState, beforeState);
        this.redoPatch = jsonPatch.compare(beforeState, afterState);
        await this.postChange?.(afterState);
    }

    /**
     * Retrieves the current state of the JSON object. Is called right before and
     * right after {@link AbstractRecordingCommand.doExecute} to derive the undo & redo patches.
     * @returns The current state of the JSON object
     */
    protected abstract getJsonObject(): MaybePromise<JsonObject>;

    /**
     * The actual execution i.e. series of changes applied to the JSOn object that should be captured.
     */
    protected abstract doExecute(): MaybePromise<void>;

    protected applyPatch(object: JsonObject, patch: jsonPatch.Operation[]): jsonPatch.PatchResult<JsonObject> {
        return jsonPatch.applyPatch(object, patch, false, true);
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

    async undo(): Promise<void> {
        if (this.undoPatch) {
            const result = this.applyPatch(await this.getJsonObject(), this.undoPatch);
            await this.postChange?.(result.newDocument);
        }
    }

    async redo(): Promise<void> {
        if (this.redoPatch) {
            const result = this.applyPatch(await this.getJsonObject(), this.redoPatch);
            await this.postChange?.(result.newDocument);
        }
    }

    canUndo(): boolean {
        return !!this.undoPatch && !!this.redoPatch;
    }

    /**
     * Optional hook that (if implemented) will be
     * executed after every command-driven action that changed
     * the underlying model i.e. command execute, undo and redo.
     */
    protected postChange?(newModel: JsonObject): MaybePromise<void>;
}

/**
 * Simple base implementation of {@link AbstractRecordingCommand} that allows recording of changes made
 * to the `GModelRoot` ({@link ModelState.root}) during the given `doExecute` function
 */
export class GModelRecordingCommand extends AbstractRecordingCommand<GModelRootSchema> {
    constructor(protected modelState: ModelState, protected serializer: GModelSerializer, protected doExecute: () => MaybePromise<void>) {
        super();
    }

    protected getJsonObject(): MaybePromise<GModelRootSchema> {
        return this.serializer.createSchema(this.modelState.root);
    }

    protected override postChange(newModel: GModelElementSchema): MaybePromise<void> {
        const newRoot = this.serializer.createRoot(newModel);
        this.modelState.updateRoot(newRoot);
    }
}
