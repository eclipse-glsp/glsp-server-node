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
import { EventId, EventStore, StreamId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * In-memory `EventStore` with a bounded LRU cap, replacing the SDK's `InMemoryEventStore`
 * (which is unbounded and explicitly intended only for examples).
 *
 * Resumability via `Last-Event-ID` requires that historical events stay reachable. Without a
 * cap, the underlying `Map` grows linearly with `MCP message volume × server uptime` — fine
 * for local-dev, a slow leak for daemonised / multi-user / CI deployments.
 *
 * Eviction shape: insert-order LRU. JS `Map` already preserves insertion order, so newer
 * events sit at the tail and `keys().next()` returns the oldest. On overflow we delete the
 * oldest — no timer, no periodic sweep, no `dispose()` plumbing required. The cap must be
 * comfortably larger than the worst-case in-flight event count (per-client × concurrent-clients
 * × disconnect-window), or a client reconnecting with a stale `Last-Event-ID` will find its
 * resume point already evicted.
 *
 * The event-id format mirrors the SDK's example impl (`<streamId>_<timestamp>_<random>`) so
 * `replayEventsAfter` can extract the stream id with the same `split('_')[0]` trick.
 */
export class LruEventStore implements EventStore {
    static readonly DEFAULT_LIMIT = 10_000;

    protected readonly events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();
    protected readonly limit: number;
    protected readonly logger?: Logger;

    constructor(limit: number = LruEventStore.DEFAULT_LIMIT, logger?: Logger) {
        if (limit < 1) {
            throw new Error(`LruEventStore limit must be >= 1, got ${limit}`);
        }
        this.limit = limit;
        this.logger = logger;
    }

    /** Current event count. Exposed for tests. */
    get size(): number {
        return this.events.size;
    }

    async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
        // Format: `<streamId>_<unixMs>_<8-char-base36-random>`. The leading `streamId` lets
        // `replayEventsAfter` recover the stream via `split('_')[0]` without a side table; the
        // timestamp + random suffix make ids globally unique across concurrent emits.
        const eventId = `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        this.events.set(eventId, { streamId, message });
        if (this.events.size > this.limit) {
            const oldest = this.events.keys().next().value;
            if (oldest !== undefined) {
                this.events.delete(oldest);
            }
        }
        return eventId;
    }

    async replayEventsAfter(
        lastEventId: EventId,
        { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> }
    ): Promise<StreamId> {
        if (!lastEventId) {
            return '';
        }
        if (!this.events.has(lastEventId)) {
            // Cap-eviction race: warn so adopters can tune `eventStoreLimit` upward.
            this.logger?.warn(
                `[LruEventStore] Replay miss for last-event-id '${lastEventId}'. ` +
                    `Cap is ${this.limit}; consider increasing \`eventStoreLimit\` if this fires under normal load.`
            );
            return '';
        }
        const streamId = lastEventId.split('_')[0];
        if (!streamId) {
            return '';
        }

        // Map iteration is insertion-order — equivalent to the SDK example's `localeCompare`
        // sort under our id format, but cheaper and not dependent on the lexicographic-vs-
        // chronological coincidence of the timestamp segment.
        let foundLast = false;
        for (const [eventId, { streamId: evtStreamId, message }] of this.events) {
            if (evtStreamId !== streamId) {
                continue;
            }
            if (eventId === lastEventId) {
                foundLast = true;
                continue;
            }
            if (foundLast) {
                await send(eventId, message);
            }
        }
        return streamId;
    }
}
