/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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

import { GLSPServer } from '@eclipse-glsp/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import * as net from 'net';
import { createAppModule } from '../di/app-module';
import { defaultSocketLaunchOptions } from './socket-cli-parser';
import { SocketServerLauncher } from './socket-server-launcher';

const serverPort = 5008;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolves whether a TCP connection to the given port is currently accepted.
 *
 * The outcome is routed through the returned promise rather than asserted inside the socket event
 * callbacks on purpose: an assertion thrown from a detached socket listener escapes the test's
 * promise chain and surfaces as a Vitest "unhandled error" that fails the run *without* turning any
 * individual test red. Resolving/rejecting keeps every outcome attributable to this test.
 */
function isReachable(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        const finish = (reachable: boolean): void => {
            socket.destroy();
            resolve(reachable);
        };
        socket
            .on('connect', () => finish(true))
            .on('error', () => finish(false))
            .on('timeout', () => finish(false))
            .connect(port);
    });
}

/** Polls until the port reaches the expected reachability, or fails the test once the deadline elapses. */
async function waitForReachable(port: number, expected: boolean, deadlineMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < deadlineMs) {
        if ((await isReachable(port)) === expected) {
            return;
        }

        await delay(50);
    }
    expect.fail(`Port ${port} did not become ${expected ? 'reachable' : 'unreachable'} within ${deadlineMs}ms`);
}

function createLauncher(): SocketServerLauncher {
    const serverStub = {
        initialize: vi.fn().mockResolvedValue({}),
        initializeClientSession: vi.fn().mockResolvedValue(undefined),
        disposeClientSession: vi.fn().mockResolvedValue(undefined),
        process: vi.fn(),
        shutdown: vi.fn(),
        addListener: vi.fn().mockReturnValue(true),
        removeListener: vi.fn().mockReturnValue(true)
    } as unknown as GLSPServer;

    const appContainer = new Container();
    appContainer.load(createAppModule(defaultSocketLaunchOptions));
    appContainer.bind(GLSPServer).toConstantValue(serverStub);
    return appContainer.resolve(SocketServerLauncher);
}

describe('test SocketServerLauncher', () => {
    let launcher: SocketServerLauncher | undefined;

    afterEach(() => {
        launcher?.shutdown();
        launcher = undefined;
    });

    it('starts and stops', async () => {
        launcher = createLauncher();

        launcher.start({ port: serverPort });
        await waitForReachable(serverPort, true);

        launcher.shutdown();
        await waitForReachable(serverPort, false);
    });

    it('resolves the address it is listening on', async () => {
        launcher = createLauncher();

        launcher.start({ port: serverPort });

        await expect(launcher.listening).resolves.toMatchObject({ port: serverPort });
    });

    it('resolves the port the operating system assigned', async () => {
        launcher = createLauncher();

        launcher.start({ port: 0 });
        const address = await launcher.listening;

        expect(address.port).toBeGreaterThan(0);
        expect(launcher.port).toBe(address.port);
        await waitForReachable(address.port, true);
    });

    it('reports no port unless it is listening', async () => {
        launcher = createLauncher();
        expect(launcher.port).toBeUndefined();

        launcher.start({ port: serverPort });
        await launcher.listening;
        expect(launcher.port).toBe(serverPort);

        launcher.shutdown();
        await waitForReachable(serverPort, false);
        expect(launcher.port).toBeUndefined();
    });

    it('notifies observers of every accepted connection', async () => {
        launcher = createLauncher();
        const accepted: net.Socket[] = [];
        launcher.onConnection(socket => accepted.push(socket));

        launcher.start({ port: serverPort });
        await launcher.listening;

        const client = net.createConnection({ port: serverPort });
        try {
            await new Promise<void>((resolve, reject) => {
                client.on('connect', () => resolve());
                client.on('error', reject);
            });
            await vi.waitFor(() => expect(accepted).toHaveLength(1));
        } finally {
            client.destroy();
        }
    });

    it('rejects if the port is already in use', async () => {
        const blocker = net.createServer();
        await new Promise<void>(resolve => blocker.listen(serverPort, () => resolve()));
        try {
            launcher = createLauncher();

            // `start` reports the same failure, so it is awaited here as well to keep every rejection handled
            const stopped = Promise.resolve(launcher.start({ port: serverPort }));

            await expect(launcher.listening).rejects.toThrow();
            await expect(stopped).rejects.toThrow();
        } finally {
            await new Promise<void>(resolve => blocker.close(() => resolve()));
        }
    });

    it('releases the server socket again when a restarted launcher is shut down', async () => {
        launcher = createLauncher();

        launcher.start({ port: serverPort });
        await waitForReachable(serverPort, true);
        launcher.shutdown();
        await waitForReachable(serverPort, false);

        launcher.start({ port: serverPort });
        await waitForReachable(serverPort, true);
        launcher.shutdown();
        await waitForReachable(serverPort, false);
    });

    it('keeps notifying observers across a restart', async () => {
        launcher = createLauncher();
        const accepted: net.Socket[] = [];
        launcher.onConnection(socket => accepted.push(socket));

        launcher.start({ port: serverPort });
        await launcher.listening;
        launcher.shutdown();
        await waitForReachable(serverPort, false);

        launcher.start({ port: serverPort });
        await launcher.listening;

        const client = net.createConnection({ port: serverPort });
        try {
            await new Promise<void>((resolve, reject) => {
                client.on('connect', () => resolve());
                client.on('error', reject);
            });
            await vi.waitFor(() => expect(accepted).toHaveLength(1));
        } finally {
            client.destroy();
        }
    });
});
