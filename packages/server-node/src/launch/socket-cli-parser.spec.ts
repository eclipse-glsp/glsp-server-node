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
import { LogLevel } from '../utils/logger';
import { createSocketCliParser, defaultSocketLaunchOptions, SocketLaunchOptions } from './socket-cli-parser';
import { expect } from 'chai';

describe('test createCliParser', () => {
    const parser = createSocketCliParser();

    parser.command.exitOverride();
    const argv = ['/usr/bin/node', 'test'];

    it('parse - no args', () => {
        const options = parser.parse(argv);
        expect(options).to.deep.equal(defaultSocketLaunchOptions);
    });

    it('parse - invalid port (below lower range)', () => {
        expect(() => parser.parse([...argv, '--port', '-1'])).to.throw;
    });

    it('parse - invalid port (below upper range)', () => {
        expect(() => parser.parse([...argv, '--port', '65536'])).to.throw;
    });

    it('parse - valid port', () => {
        const port = 3000;
        const result = parser.parse([...argv, '--port', '3000']);
        expect(result.port).to.equal(port);
    });

    it('parse - --no-consoleLog', () => {
        const result = parser.parse([...argv, '--no-consoleLog']);
        expect(result.consoleLog).false;
    });

    it('parse - --fileLog', () => {
        const result = parser.parse([...argv, '--fileLog']);
        expect(result.fileLog).true;
    });

    it('parse - custom host name', () => {
        const host = 'docker.internal';
        const result = parser.parse([...argv, '--host', host]);
        expect(result.host, host);
    });

    it('parse- no args with custom default options', () => {
        const options: SocketLaunchOptions = {
            logDir: '.myLogDir',
            logLevel: LogLevel.debug,
            consoleLog: true,
            fileLog: true,
            host: 'myHost',
            port: 3000
        };
        const result = createSocketCliParser(options).parse(argv);
        expect(result).to.deep.equal(options);
    });
});
