/********************************************************************************
 * Copyright (c) 2023-2026 EclipseSource and others.
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

import { AnyObject, MaybePromise } from '@eclipse-glsp/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { AbstractRecordingCommand } from './recording-command';

interface TestModel {
    string: string;
    number: number;
    flag: boolean;
    maybe?: AnyObject;
}

let jsonObject: TestModel;

class TestRecordingCommand<JsonObject extends AnyObject = AnyObject> extends AbstractRecordingCommand<JsonObject> {
    constructor(
        protected jsonObject: JsonObject,
        protected doExecute: () => MaybePromise<void>
    ) {
        super();
    }

    protected getJsonObject(): MaybePromise<JsonObject> {
        return this.jsonObject;
    }
}

describe('RecordingCommand', () => {
    let beforeState: TestModel;

    beforeEach(() => {
        jsonObject = {
            string: 'foo',
            number: 0,
            flag: true
        };
        beforeState = JSON.parse(JSON.stringify(jsonObject));
    });

    it('should be undoable after execution', async () => {
        const command = new TestRecordingCommand(jsonObject, () => {});
        expect(command.canUndo()).toBe(false);
        await command.execute();
        expect(command.canUndo()).toBe(true);
    });

    it('should restore the pre execution state when undo is called', async () => {
        const command = new TestRecordingCommand(jsonObject, () => {
            jsonObject.string = 'bar';
            jsonObject.flag = false;
            jsonObject.maybe = { hello: 'world' };
        });
        await command.execute();
        expect(jsonObject).not.toEqual(beforeState);
        await command.undo();
        expect(jsonObject).toEqual(beforeState);
    });

    it('should restore the post execution state when redo is called', async () => {
        const command = new TestRecordingCommand(jsonObject, () => {
            jsonObject.string = 'bar';
            jsonObject.flag = false;
            jsonObject.maybe = { hello: 'world' };
        });
        await command.execute();
        const afterState = JSON.parse(JSON.stringify(jsonObject));
        jsonObject = JSON.parse(JSON.stringify(afterState));
        await command.redo();
        expect(jsonObject).toEqual(afterState);
    });
});
