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

import { AnyObject } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { RecordingCommand } from './recording-command';

interface TestModel {
    string: string;
    number: number;
    flag: boolean;
    maybe?: AnyObject;
}

let jsonObject: TestModel;

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

    it('should be undoable after execution', () => {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const command = new RecordingCommand(jsonObject, () => {});
        expect(command.canUndo()).to.be.false;
        command.execute();
        expect(command.canUndo()).to.be.true;
    });

    it('should restore the pre execution state when undo is called', () => {
        const command = new RecordingCommand(jsonObject, () => {
            jsonObject.string = 'bar';
            jsonObject.flag = false;
            jsonObject.maybe = { hello: 'world' };
        });
        command.execute();
        expect(jsonObject).to.not.be.deep.equals(beforeState);
        command.undo();
        expect(jsonObject).to.be.deep.equals(beforeState);
    });

    it('should restore the post execution state when redo is called', () => {
        const command = new RecordingCommand(jsonObject, () => {
            jsonObject.string = 'bar';
            jsonObject.flag = false;
            jsonObject.maybe = { hello: 'world' };
        });
        command.execute();
        const afterState = JSON.parse(JSON.stringify(jsonObject));
        jsonObject = JSON.parse(JSON.stringify(afterState));
        command.redo();
        expect(jsonObject).to.be.deep.equals(afterState);
    });
});
