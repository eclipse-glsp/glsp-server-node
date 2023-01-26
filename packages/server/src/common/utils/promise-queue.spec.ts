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
import { delay } from '../test/mock-util';
import { PromiseQueue } from './promise-queue';
import { expect } from 'chai';

// Helper types and functions that are needed for test setup

/**
 * Helper class to inspect the state of promise during its resolve() execution.
 */
class PromiseState {
    private _started = false;
    private _stopped = false;
    onStartRunnable?: () => void;
    onStopRunnable?: () => void;

    start(): void {
        this._started = true;
        if (this.onStartRunnable) {
            this.onStartRunnable();
        }
    }

    stop(): void {
        this._stopped = true;
        if (this.onStopRunnable) {
            this.onStopRunnable();
        }
    }

    onStart(runnable: () => void): void {
        this.onStartRunnable = runnable;
    }

    onStop(runnable: () => void): void {
        this.onStopRunnable = runnable;
    }

    get started(): boolean {
        return this._started;
    }

    get stopped(): boolean {
        return this._stopped;
    }
}

interface TestPromise {
    state: PromiseState;
    promise: () => Promise<void>;
}

function newTestPromise(resolveTime: number): TestPromise {
    const state = new PromiseState();
    const promise = async (): Promise<void> => {
        state.start();
        await delay(resolveTime);
        state.stop();
    };
    return { state, promise };
}

let queue = new PromiseQueue();

// Test execution
describe('test PromiseQueue', () => {
    beforeEach(() => {
        queue = new PromiseQueue();
    });
    it('enqueue - one element', async () => {
        const { state, promise } = newTestPromise(100);
        state.onStart(() => {
            expect(queue.isBusy).true;
        });
        const queEnd = queue.enqueue(promise);
        expect(queue.isEmpty).true;
        await queEnd;
    });

    it('enqueue - two elements', async () => {
        const p1 = newTestPromise(100);
        p1.state.onStop(() => expect(p2.state.started).false);

        const p2 = newTestPromise(100);

        p2.state.onStart(() => {
            expect(queue.isEmpty).true;
            expect(p1.state.stopped).true;
        });

        queue.enqueue(p1.promise);
        const queEnd = queue.enqueue(p2.promise);
        expect(queue.size).to.be.equal(1);
        await queEnd;
    });

    it('enqueue - three elements (first promise in queue has longest resolve time)', async () => {
        const p1 = newTestPromise(300);
        p1.state.onStop(() => {
            expect(p2.state.started).false;
            expect(p3.state.started).false;
        });

        const p2 = newTestPromise(200);
        p2.state.onStart(() => {
            expect(queue.size).to.be.equal(1);
            expect(p1.state.stopped).true;
            expect(p3.state.started).false;
        });

        const p3 = newTestPromise(100);
        p3.state.onStart(() => {
            expect(queue.isEmpty).true;
            expect(p2.state.stopped).true;
        });

        queue.enqueue(p1.promise);
        queue.enqueue(p2.promise);
        expect(queue.size).to.be.equal(1);
        const queueEnd = queue.enqueue(p3.promise);
        expect(queue.size).to.be.equal(2);
        await queueEnd;
    });
});
