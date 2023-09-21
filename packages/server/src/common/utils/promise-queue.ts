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

/**
 * Description for promises that are put into a queue and
 * resolved once dequeued.
 */
export interface PromiseQueueElement<T = void> {
    promise: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
}

/**
 * A data structure that enables controlled,sequential resolving
 * of promises. Promises that are put in this queue are processed one by one.
 * i.e. After the first promise in the queue is resolved, it will be removed from the queue and the resolving of the
 * the next promise (if present) will start. The queue can only resolve one promise at a given time.
 */
export class PromiseQueue<T = void> {
    protected queue: PromiseQueueElement<T>[] = [];
    protected busy = false;

    /**
     * Add a {@link PromiseQueueElement} to the queue
     * @param promise The element that should be queued
     * @param atStart if `true` the element is added to the start of queue, otherwise it's added at queue end.
     * @returns A promise of the queued promise that resolves once dequeued.
     */
    enqueue(promise: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const element = {
                promise,
                resolve,
                reject
            };
            this.queue.push(element);
            this.dequeue();
        });
    }

    protected dequeue(): boolean {
        if (this.busy) {
            return false;
        }

        const element = this.queue.shift();
        if (!element) {
            return false;
        }

        this.busy = true;
        this.resolveQueuedPromise(element).catch(error => {
            element.reject(error);
            this.busy = false;
            this.dequeue();
        });

        return true;
    }

    protected async resolveQueuedPromise(element: PromiseQueueElement<T>): Promise<void> {
        try {
            const value = await element.promise();
            return element.resolve(value);
        } catch (error) {
            element.reject(error);
        } finally {
            this.busy = false;
            this.dequeue();
        }
    }

    get isBusy(): boolean {
        return this.busy;
    }

    get size(): number {
        return this.queue.length;
    }

    get isEmpty(): boolean {
        return this.queue.length === 0;
    }

    clear(): void {
        this.queue = [];
    }
}
