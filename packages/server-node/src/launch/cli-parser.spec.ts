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
import * as path from 'path';
import { LogLevel } from '../utils/logger';
import { createCliParser, defaultLaunchOptions } from './cli-parser';
import { expect } from 'chai';

describe('test createCliParser', () => {
    const parser = createCliParser();

    parser.command.exitOverride();
    const argv = ['/usr/bin/node', 'test'];

    it('parse - no args', () => {
        const options = parser.parse(argv);
        expect(options).to.deep.equal(defaultLaunchOptions);
    });

    it('parse - invalid log dir', () => {
        expect(() => parser.parse([...argv, '--logDir', 'invalid.Path'])).to.throw;
    });

    it('parse - valid log dir', () => {
        const logDir = path.resolve('../customLog');
        const result = parser.parse([...argv, '--logDir', '../customLog/']);
        expect(result.logDir, logDir);
    });

    it('parse - invalid logLevel', () => {
        expect(() => parser.parse([...argv, '--logLevel', 'someRandomLevel'])).to.throw;
    });

    it('parse - valid logLevel', () => {
        const result = parser.parse([...argv, '--logLevel', 'error']);
        expect(result.logLevel).to.be.equal(LogLevel.error);
    });

    it('parse- no args with custom default options', () => {
        const options = {
            logDir: '.myLogDir',
            logLevel: LogLevel.debug,
            consoleLog: false,
            fileLog: true
        };
        const result = createCliParser(options).parse(argv);
        expect(result).to.deep.equal(options);
    });
});
