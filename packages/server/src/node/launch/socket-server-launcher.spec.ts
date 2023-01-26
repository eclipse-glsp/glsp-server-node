/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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

import { expect } from 'chai';
import { Container } from 'inversify';
import * as net from 'net';
import { createAppModule } from '../di/app-module';
import { defaultSocketLaunchOptions } from './socket-cli-parser';
import { SocketServerLauncher } from './socket-server-launcher';
const severPort = 5008;
describe('test SocketServerLauncher', () => {
    it('starts and stops', async () => {
        const appContainer = new Container();
        appContainer.load(createAppModule(defaultSocketLaunchOptions));
        const launcher = appContainer.resolve(SocketServerLauncher);
        launcher.start({ port: severPort });
        const sockStart = new net.Socket();
        sockStart.setTimeout(100);
        const startPromise = new Promise(res => {
            sockStart
                .on('connect', () => {
                    expect(true);
                    sockStart.destroy();
                    res(true);
                })
                .on('error', e => {
                    expect.fail('Server is not reachable: ' + e.message);
                })
                .on('timeout', () => {
                    expect.fail('Connection time outed.');
                })
                .connect(severPort);
        });
        await startPromise;
        launcher.shutdown();
        const sockStop = new net.Socket();
        sockStop.setTimeout(100);
        const stopPromise = new Promise(res => {
            sockStop
                .on('connect', () => {
                    expect.fail('Server still reachable.');
                })
                .on('error', () => {
                    expect(true);
                    sockStop.destroy();
                    res(true);
                })
                .on('timeout', () => {
                    expect.fail('Connection time outed.');
                })
                .connect(severPort);
        });
        await stopPromise;
    });
});
