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

// Proxies `fetch('/mcp', ...)` calls from the page to the embedded Web Worker via a MessageChannel
// the page hands over at boot. Lets the page use plain `fetch` (or the MCP SDK's standard
// `StreamableHTTPClientTransport`) without the worker needing to host an HTTP listener.

const PENDING_TIMEOUT_MS = 60_000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

let workerPort;
let resolveWorkerPort;
let workerPortPromise = new Promise(resolve => {
    resolveWorkerPort = resolve;
});
const pending = new Map();
let nextId = 1;

function failPending(id, status, statusText, message) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timeout);
    entry.resolve({ type: 'mcp-response', id, status, statusText, headers: { 'content-type': 'text/plain' }, body: message });
}

function failAllPending(reason) {
    for (const id of [...pending.keys()]) {
        failPending(id, 503, 'Service Unavailable', reason);
    }
}

self.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.type !== 'mcp-init-port') {
        return;
    }
    const port = event.ports[0];
    if (!port) {
        return;
    }
    // Port replacement (page reload, worker swap) — orphan any in-flight resolvers cleanly.
    if (workerPort && workerPort !== port) {
        failAllPending('MCP worker port replaced before response arrived');
        workerPortPromise = new Promise(resolve => {
            resolveWorkerPort = resolve;
        });
    }
    workerPort = port;
    workerPort.onmessage = portEvent => {
        const reply = portEvent.data;
        if (!reply || reply.type !== 'mcp-response') {
            return;
        }
        const entry = pending.get(reply.id);
        if (entry) {
            pending.delete(reply.id);
            clearTimeout(entry.timeout);
            entry.resolve(reply);
        }
    };
    workerPort.start();
    resolveWorkerPort(workerPort);
});

self.addEventListener('fetch', event => {
    if (new URL(event.request.url).pathname !== '/mcp') {
        return;
    }
    event.respondWith(handleMcp(event.request));
});

async function handleMcp(request) {
    if (!workerPort) {
        await workerPortPromise;
    }
    const id = `${Date.now()}-${nextId++}`;
    const headers = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });
    const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.text();
    const reply = await new Promise(resolve => {
        const timeout = setTimeout(
            () => failPending(id, 504, 'Gateway Timeout', `MCP worker bridge timed out after ${PENDING_TIMEOUT_MS}ms`),
            PENDING_TIMEOUT_MS
        );
        pending.set(id, { resolve, timeout });
        workerPort.postMessage({ type: 'mcp-request', id, url: request.url, method: request.method, headers, body });
    });
    return new Response(reply.body, {
        status: reply.status,
        statusText: reply.statusText,
        headers: reply.headers
    });
}
