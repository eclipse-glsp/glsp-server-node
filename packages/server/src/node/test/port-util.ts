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
import * as net from 'net';
import { expect } from 'vitest';

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolves whether a TCP connection to the given port is currently accepted.
 *
 * The outcome is routed through the returned promise rather than asserted inside the socket event
 * callbacks on purpose: an assertion thrown from a detached socket listener escapes the test's
 * promise chain and surfaces as a Vitest "unhandled error" that fails the run *without* turning any
 * individual test red. Resolving/rejecting keeps every outcome attributable to the calling test.
 */
export function isReachable(port: number): Promise<boolean> {
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
export async function waitForReachable(port: number, expected: boolean, deadlineMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < deadlineMs) {
        if ((await isReachable(port)) === expected) {
            return;
        }

        await delay(50);
    }
    expect.fail(`Port ${port} did not become ${expected ? 'reachable' : 'unreachable'} within ${deadlineMs}ms`);
}
