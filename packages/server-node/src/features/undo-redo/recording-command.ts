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

import { AnyObject } from '@eclipse-glsp/protocol';
import * as jsonPatch from 'fast-json-patch';
import 'reflect-metadata';
import { Command } from './command';

/**
 * An abstract base implementation for {@link Command} that should records changes made to a JSON object during execution.
 * These changes are recorded in the form of json patches.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export abstract class AbstractRecordingCommand<JsonObject extends Object> implements Command {
    protected undoPatch?: jsonPatch.Operation[];
    protected redoPatch?: jsonPatch.Operation[];

    execute(): void {
        const beforeState = this.deepClone(this.getJsonObject());
        this.doExecute();
        const afterState = this.getJsonObject();
        this.undoPatch = jsonPatch.compare(afterState, beforeState);
        this.redoPatch = jsonPatch.compare(beforeState, afterState);
    }

    protected abstract getJsonObject(): JsonObject;

    protected abstract doExecute(): void;

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
        return true;
    }
}

export class RecordingCommand extends AbstractRecordingCommand<AnyObject> {
    constructor(protected jsonObject: AnyObject, protected doExecute: () => void) {
        super();
    }

    protected getJsonObject(): AnyObject {
        return this.jsonObject;
    }
}
