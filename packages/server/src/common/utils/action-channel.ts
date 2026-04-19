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

/**
 * An entry yielded by {@link ActionChannel.consume}. The consumer must call either
 * `resolve()` or `reject(error)` exactly once after processing `item`.
 */
export interface ActionChannelEntry<T> {
    item: T;
    resolve: () => void;
    reject: (error: unknown) => void;
}

/**
 * Producer/consumer channel with a single async consumer loop. Mirrors the Java
 * dispatcher's `BlockingQueue` + consumer thread architecture.
 *
 * Items pushed via {@link push} are yielded by {@link consume} in FIFO order.
 * The promise returned by `push()` resolves or rejects when the consumer finishes
 * processing the item (so producers can propagate errors back to callers).
 */
export class ActionChannel<T> {
    protected queue: ActionChannelEntry<T>[] = [];
    protected notify: (() => void) | undefined;
    protected stopped = false;

    /**
     * Enqueues an item and returns a promise that settles when the consumer processes it.
     * Rejects immediately if the channel has been stopped.
     */
    push(item: T): Promise<void> {
        if (this.stopped) {
            return Promise.reject(new Error('ActionChannel is stopped'));
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });
            this.notify?.();
        });
    }

    /**
     * Yields pending entries in FIFO order, blocking on a notification promise when empty.
     * Exits once the channel is stopped and the queue has been drained.
     */
    async *consume(): AsyncGenerator<ActionChannelEntry<T>> {
        while (!this.stopped || this.queue.length > 0) {
            while (this.queue.length > 0) {
                yield this.queue.shift()!;
            }
            if (this.stopped) {
                return;
            }
            await new Promise<void>(resolve => {
                this.notify = resolve;
            });
            this.notify = undefined;
        }
    }

    /**
     * Stops the channel. Further {@link push} calls reject. The consumer loop exits after
     * the remaining queued entries have been yielded (or immediately if the queue is empty).
     */
    stop(): void {
        this.stopped = true;
        this.notify?.();
    }

    /**
     * Rejects all queued entries with the given reason so producers awaiting their
     * `push()` promises do not hang. Does not stop the channel.
     */
    rejectPending(reason: Error = new Error('ActionChannel cleared')): void {
        const pending = this.queue;
        this.queue = [];
        for (const entry of pending) {
            entry.reject(reason);
        }
    }

    get size(): number {
        return this.queue.length;
    }

    get isStopped(): boolean {
        return this.stopped;
    }
}
