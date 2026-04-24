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
import { expect } from 'chai';
import { expectToThrowAsync } from '../test/mock-util';
import { ActionChannel } from './action-channel';

describe('ActionChannel', () => {
    it('yields pushed items in FIFO order', async () => {
        const channel = new ActionChannel<number>();
        const consumed: number[] = [];

        const consumer = (async (): Promise<void> => {
            for await (const entry of channel.consume()) {
                consumed.push(entry.item);
                entry.resolve();
            }
        })();

        await Promise.all([channel.push(1), channel.push(2), channel.push(3)]);
        channel.stop();
        await consumer;

        expect(consumed).to.deep.equal([1, 2, 3]);
    });

    it('resolves the push promise once the consumer resolves the entry', async () => {
        const channel = new ActionChannel<string>();
        let entryResolver: (() => void) | undefined;

        const consumer = (async (): Promise<void> => {
            for await (const entry of channel.consume()) {
                entryResolver = entry.resolve;
                return;
            }
        })();

        const pushed = channel.push('a');
        // Give the consumer a turn to pick up the entry.
        await Promise.resolve();
        await consumer;
        expect(entryResolver).to.exist;
        entryResolver!();
        await pushed;
    });

    it('propagates reject() from the consumer back to the pushing caller', async () => {
        const channel = new ActionChannel<number>();

        const consumer = (async (): Promise<void> => {
            for await (const entry of channel.consume()) {
                entry.reject(new Error('boom'));
                return;
            }
        })();

        const pushed = channel.push(1);
        await consumer;
        await expectToThrowAsync(() => pushed, 'boom');
    });

    it('rejects push() after stop()', async () => {
        const channel = new ActionChannel<number>();
        channel.stop();
        await expectToThrowAsync(() => channel.push(1), 'ActionChannel is stopped');
    });

    it('consumer exits after stop() and drain', async () => {
        const channel = new ActionChannel<number>();
        const consumed: number[] = [];

        const consumer = (async (): Promise<void> => {
            for await (const entry of channel.consume()) {
                consumed.push(entry.item);
                entry.resolve();
            }
        })();

        await channel.push(1);
        await channel.push(2);
        channel.stop();
        await consumer;

        expect(consumed).to.deep.equal([1, 2]);
        expect(channel.isStopped).to.be.true;
    });

    it('rejectPending() rejects all queued push() promises without stopping', async () => {
        const channel = new ActionChannel<number>();
        const pushes = [channel.push(1), channel.push(2)];
        expect(channel.size).to.equal(2);

        channel.rejectPending(new Error('cleared'));

        await expectToThrowAsync(() => pushes[0], 'cleared');
        await expectToThrowAsync(() => pushes[1], 'cleared');
        expect(channel.size).to.equal(0);
        expect(channel.isStopped).to.be.false;
    });

    it('size reflects the number of unconsumed entries', async () => {
        const channel = new ActionChannel<number>();
        channel.push(1);
        channel.push(2);
        channel.push(3);
        expect(channel.size).to.equal(3);
    });

    it('throws when a second consumer is started', async () => {
        const channel = new ActionChannel<number>();
        const first = channel.consume();
        // Kick off the first consumer so it registers as the active consumer.
        const firstStep = first.next();

        const second = channel.consume();
        await expectToThrowAsync(() => second.next().then(() => undefined), 'ActionChannel supports only a single consumer');

        channel.stop();
        await firstStep;
    });
});
