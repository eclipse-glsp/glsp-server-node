/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import { Container } from 'inversify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createAppModule } from '../di/app-module';
import { waitForReachable } from '../test/port-util';
import { defaultLaunchOptions } from './cli-parser';
import { AcceptedWebSocket, WebSocketServerLauncher } from './websocket-server-launcher';

const serverPort = 5009;
const serverPath = 'test';

function createLauncher(): WebSocketServerLauncher {
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
    appContainer.load(createAppModule(defaultLaunchOptions));
    appContainer.bind(GLSPServer).toConstantValue(serverStub);
    return appContainer.resolve(WebSocketServerLauncher);
}

function connect(query = ''): WebSocket {
    return new WebSocket(`ws://localhost:${serverPort}/${serverPath}${query}`);
}

describe('test WebSocketServerLauncher', () => {
    let launcher: WebSocketServerLauncher | undefined;

    afterEach(() => {
        launcher?.shutdown();
        launcher = undefined;
    });

    it('resolves the address it is listening on', async () => {
        launcher = createLauncher();
        const listening = launcher.listening;

        launcher.start({ port: serverPort, path: serverPath });

        await expect(listening).resolves.toMatchObject({ port: serverPort });
        expect(launcher.port).toBe(serverPort);
    });

    it('releases the server socket again when a restarted launcher is shut down', async () => {
        launcher = createLauncher();

        launcher.start({ port: serverPort, path: serverPath });
        await waitForReachable(serverPort, true);
        launcher.shutdown();
        await waitForReachable(serverPort, false);

        launcher.start({ port: serverPort, path: serverPath });
        await waitForReachable(serverPort, true);
        launcher.shutdown();
        await waitForReachable(serverPort, false);
    });

    it('releases the server socket when shut down while still starting up', async () => {
        launcher = createLauncher();

        launcher.start({ port: serverPort, path: serverPath });
        launcher.shutdown();

        await waitForReachable(serverPort, false);
    });

    it('notifies observers of every accepted connection with its upgrade request', async () => {
        launcher = createLauncher();
        const accepted: AcceptedWebSocket[] = [];
        launcher.onConnection(connection => accepted.push(connection));

        launcher.start({ port: serverPort, path: serverPath });
        await launcher.listening;

        const client = connect('?client=42');
        try {
            await new Promise<void>((resolve, reject) => {
                client.on('open', () => resolve());
                client.on('error', reject);
            });
            await vi.waitFor(() => expect(accepted).toHaveLength(1));
            expect(accepted[0].request.url).toContain('client=42');
        } finally {
            client.close();
        }
    });
});
