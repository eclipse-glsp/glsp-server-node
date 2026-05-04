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

import { Logger } from '@eclipse-glsp/server';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { expect } from 'chai';
import { LruEventStore } from './lru-event-store';

function jsonRpc(id: number): JSONRPCMessage {
    return { jsonrpc: '2.0', id, result: { value: id } };
}

describe('LruEventStore', () => {
    it('rejects an invalid limit (< 1)', () => {
        expect(() => new LruEventStore(0)).to.throw(/limit must be >= 1/);
        expect(() => new LruEventStore(-5)).to.throw(/limit must be >= 1/);
    });

    it('storeEvent returns a streamId-prefixed event id', async () => {
        const store = new LruEventStore();
        const id = await store.storeEvent('stream-A', jsonRpc(1));
        expect(id.split('_')[0]).to.equal('stream-A');
    });

    it('evicts the oldest event once the cap is exceeded', async () => {
        const store = new LruEventStore(3);
        const id1 = await store.storeEvent('s', jsonRpc(1));
        const id2 = await store.storeEvent('s', jsonRpc(2));
        await store.storeEvent('s', jsonRpc(3));

        expect(store.size).to.equal(3);

        // Adding a 4th event evicts the oldest (id1).
        const id4 = await store.storeEvent('s', jsonRpc(4));
        expect(store.size).to.equal(3);

        // Replay since id1 → can't find it (evicted) → returns ''.
        const replayed: string[] = [];
        const streamId = await store.replayEventsAfter(id1, {
            send: async eventId => {
                replayed.push(eventId);
            }
        });
        expect(streamId).to.equal(''); // id1 has been evicted
        expect(replayed).to.have.lengthOf(0);

        // Replay since id2 still works — id3 (still in store) and id4 are sent in order.
        const replayedFromId2: string[] = [];
        await store.replayEventsAfter(id2, {
            send: async eventId => {
                replayedFromId2.push(eventId);
            }
        });
        expect(replayedFromId2).to.have.lengthOf(2);
        expect(replayedFromId2[1]).to.equal(id4);
    });

    it('replays only events from the same stream after the lastEventId', async () => {
        const store = new LruEventStore();
        const a1 = await store.storeEvent('A', jsonRpc(1));
        await store.storeEvent('B', jsonRpc(2)); // different stream — must be skipped
        const a3 = await store.storeEvent('A', jsonRpc(3));
        const a4 = await store.storeEvent('A', jsonRpc(4));

        const replayed: Array<{ id: string; msg: JSONRPCMessage }> = [];
        const streamId = await store.replayEventsAfter(a1, {
            send: async (id, msg) => {
                replayed.push({ id, msg });
            }
        });

        expect(streamId).to.equal('A');
        expect(replayed.map(e => e.id)).to.deep.equal([a3, a4]);
    });

    it('returns "" when lastEventId is unknown', async () => {
        const store = new LruEventStore();
        await store.storeEvent('A', jsonRpc(1));

        const streamId = await store.replayEventsAfter('A_999_xxx', {
            send: async () => {
                throw new Error('should not be called');
            }
        });

        expect(streamId).to.equal('');
    });

    it('logs a cap-eviction warn when replaying an evicted last-event-id', async () => {
        const warns: string[] = [];
        const logger = { warn: (message: string) => warns.push(message) } as unknown as Logger;
        const store = new LruEventStore(2, logger);
        const evictedId = await store.storeEvent('s', jsonRpc(1));
        await store.storeEvent('s', jsonRpc(2));
        await store.storeEvent('s', jsonRpc(3));

        const streamId = await store.replayEventsAfter(evictedId, {
            send: async () => {
                throw new Error('should not be called');
            }
        });

        expect(streamId).to.equal('');
        expect(warns).to.have.lengthOf(1);
        expect(warns[0]).to.match(/Replay miss/);
        expect(warns[0]).to.include('Cap is 2');
    });
});
