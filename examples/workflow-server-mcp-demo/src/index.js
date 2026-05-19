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
import { BrowserMessageReader, BrowserMessageWriter, createMessageConnection } from 'vscode-jsonrpc/browser';

const GLSP_PROTOCOL_VERSION = '1.0.0';
const MCP_PROTOCOL_VERSION = '2025-03-26';
const MCP_URL = '/mcp';
const DIAGRAM_TYPE = 'workflow-diagram';
const CLIENT_SESSION_ID = 'smoke-' + Math.random().toString(36).slice(2, 9);

// Server-pushed action kinds we want forwarded to us via JSON-RPC `process` notifications.
// The framework's `ClientActionForwarder` consults this list; anything not in it triggers a
// "No handler registered" error on the server. Extend as new server-side actions surface.
const CLIENT_ACTION_KINDS = [
    'status',
    'startProgress',
    'endProgress',
    'requestBounds',
    'setDirtyState',
    'setMarkers',
    'setEditMode',
    'updateModel',
    'setModel',
    'selectAll',
    'selectAction',
    'elementSelected',
    'sourceModelChanged'
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIRTY_RENDER_DEBOUNCE_MS = 80;

const dom = {
    log: document.getElementById('log'),
    bootStatus: document.getElementById('boot-status'),
    systemIndicator: document.getElementById('system-indicator'),
    glspSession: document.getElementById('glsp-session'),
    mcpSession: document.getElementById('mcp-session'),
    btnMcpInit: document.getElementById('btn-mcp-init'),
    btnMcpTools: document.getElementById('btn-mcp-tools'),
    btnMcpSessionInfo: document.getElementById('btn-mcp-session-info'),
    btnMcpElementTypes: document.getElementById('btn-mcp-element-types'),
    btnMcpQuery: document.getElementById('btn-mcp-query'),
    btnMcpValidate: document.getElementById('btn-mcp-validate'),
    btnMcpCreate: document.getElementById('btn-mcp-create'),
    btnMcpMove: document.getElementById('btn-mcp-move'),
    btnMcpDelete: document.getElementById('btn-mcp-delete'),
    btnMcpUndo: document.getElementById('btn-mcp-undo'),
    btnMcpRedo: document.getElementById('btn-mcp-redo'),
    btnMcpTerminate: document.getElementById('btn-mcp-terminate'),
    btnClear: document.getElementById('btn-clear'),
    lastResultTitle: document.getElementById('last-result-title'),
    lastResult: document.getElementById('last-result'),
    diagramDirty: document.getElementById('diagram-dirty'),
    diagram: document.getElementById('diagram-canvas'),
    infoBar: document.getElementById('info-bar'),
    statusLine: document.getElementById('status-line'),
    progressRow: document.getElementById('progress-row'),
    progressTitle: document.getElementById('progress-title'),
    progressBar: document.getElementById('progress-bar')
};

function setSystemState(state, label) {
    if (!dom.systemIndicator) return;
    dom.systemIndicator.dataset.state = state;
    dom.systemIndicator.textContent = label;
}

// ---------- log + helpers ----------

function logEntry(kind, summary, payload) {
    const entry = document.createElement('details');
    if (kind === 'error') entry.classList.add('error');
    entry.open = true;
    const sum = document.createElement('summary');
    sum.textContent = `[${new Date().toLocaleTimeString()}] ${summary}`;
    entry.appendChild(sum);
    const pre = document.createElement('pre');
    pre.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    entry.appendChild(pre);
    dom.log.prepend(entry);
}

function headersToObject(headers) {
    const result = {};
    headers.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

// ---------- GLSP client ----------

/**
 * Thin wrapper around `vscode-jsonrpc/browser` that knows the handful of GLSP requests
 * this smoke needs: `initialize`, `initializeClientSession`, plus `process` notifications
 * for action message round-trips (`requestModel` out, server-pushed actions in).
 */
class GlspClient {
    /** @param {Worker} worker */
    constructor(worker) {
        const reader = new BrowserMessageReader(worker);
        const writer = new BrowserMessageWriter(worker);
        this.connection = createMessageConnection(reader, writer);
        this.connection.onError(err => logEntry('error', 'GLSP JSON-RPC error', String(err)));
        this._actionHandler = null;
        this.connection.onNotification('process', message => {
            if (this._actionHandler && message && message.action) {
                this._actionHandler(message.action);
            }
        });
        this.connection.listen();
    }

    /** @param {(action: any) => void} handler */
    onAction(handler) {
        this._actionHandler = handler;
    }

    async initialize(applicationId, mcpServerOptions) {
        logEntry('request', '→ GLSP initialize', { mcpServer: mcpServerOptions });
        const result = await this.connection.sendRequest('initialize', {
            applicationId,
            protocolVersion: GLSP_PROTOCOL_VERSION,
            mcpServer: mcpServerOptions
        });
        logEntry('response', '← GLSP initialize', result);
        return result;
    }

    async initializeClientSession(clientSessionId, diagramType, clientActionKinds) {
        const params = { diagramType, clientSessionId, clientActionKinds, args: {} };
        logEntry('request', '→ GLSP initializeClientSession', params);
        await this.connection.sendRequest('initializeClientSession', params);
        logEntry('response', '← GLSP initializeClientSession', { ok: true });
    }

    /** Send an action to the server via `process` notification. */
    dispatchAction(clientId, action) {
        this.connection.sendNotification('process', { clientId, action });
    }
}

// ---------- bounds reply (RequestBoundsAction → ComputedBoundsAction) ----------

// The workflow MCP serializer drops task elements whose label child has no Dimension. A
// real Sprotty-based client computes those via DOM measurement and replies; here we
// estimate per element type so new nodes survive the serializer's filter.
function estimateBounds(element) {
    const type = typeof element.type === 'string' ? element.type : '';
    if (type === 'label:heading' || type.startsWith('label')) {
        const textLen = typeof element.text === 'string' ? element.text.length : 5;
        return { width: Math.max(20, textLen * 7), height: 16 };
    }
    if (type.startsWith('task')) return { width: 80, height: 30 };
    if (type === 'icon') return { width: 25, height: 20 };
    if (type.startsWith('activityNode')) return { width: 32, height: 32 };
    return { width: 60, height: 30 };
}

function collectMissingBounds(root) {
    const bounds = [];
    const stack = [root];
    while (stack.length) {
        const element = stack.pop();
        if (!element) continue;
        const size = element.size;
        const hasSize = size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
        if (typeof element.id === 'string' && !hasSize) {
            bounds.push({ elementId: element.id, newSize: estimateBounds(element) });
        }
        if (Array.isArray(element.children)) {
            for (const child of element.children) stack.push(child);
        }
    }
    return bounds;
}

function buildComputedBoundsAction(requestAction) {
    // `ComputedBoundsActionHandler` discards the reply unless `revision` matches the
    // current `modelState.root.revision`. Mirror the request's newRoot revision.
    return {
        kind: 'computedBounds',
        bounds: collectMissingBounds(requestAction.newRoot),
        revision: requestAction.newRoot?.revision,
        responseId: requestAction.requestId
    };
}

// ---------- MCP client ----------

let rpcId = 1;
let mcpSessionId = '';

function mcpHeaders() {
    return mcpSessionId ? { 'mcp-session-id': mcpSessionId, 'mcp-protocol-version': MCP_PROTOCOL_VERSION } : {};
}

// Parse a Streamable HTTP MCP response body. The transport returns either plain JSON or
// SSE-framed (`event:` / `data:` lines); we want the JSON payload either way.
async function readResponseBody(response) {
    const text = await response.text();
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
        for (const line of text.split('\n')) {
            const stripped = line.trim();
            if (stripped.startsWith('data:')) {
                try {
                    return JSON.parse(stripped.slice(5).trim());
                } catch {
                    /* fall through to raw text */
                }
            }
        }
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function mcpFetch(extraHeaders, jsonBody, summary, options = {}) {
    const headers = {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...extraHeaders
    };
    const method = options.method ?? 'POST';
    const fetchInit = { method, headers };
    if (jsonBody !== undefined) {
        fetchInit.body = JSON.stringify(jsonBody);
        logEntry('request', `→ ${method} ${MCP_URL}`, { headers, body: jsonBody });
    } else {
        logEntry('request', `→ ${method} ${MCP_URL}`, { headers });
    }
    try {
        const response = await fetch(MCP_URL, fetchInit);
        const responseHeaders = headersToObject(response.headers);
        const body = await readResponseBody(response);
        logEntry(response.ok ? 'response' : 'error', `← ${response.status} ${response.statusText} ${summary}`, {
            headers: responseHeaders,
            body
        });
        // `internal` calls are infrastructure round-trips (e.g. the auto `diagram-model` fetch after
        // each mutation) — they shouldn't clobber the user-visible last-result panel.
        if (!options.internal) {
            renderLastResult(summary, body);
        }
        return { response, headers: responseHeaders, body };
    } catch (err) {
        logEntry('error', `← ${summary} failed`, String(err));
        throw err;
    }
}

function mcpToolCall(name, args, summary, options) {
    return mcpFetch(
        mcpHeaders(),
        { jsonrpc: '2.0', id: rpcId++, method: 'tools/call', params: { name, arguments: args } },
        summary,
        options
    );
}

// ---------- last-result panel ----------

// Pretty-print the most recent MCP response. Recognises the common shapes the demo's tools
// emit (arrays of {name, description, …}, plain primitive objects, text-only `content`) and
// falls back to indented JSON when it can't summarise meaningfully.
function renderLastResult(summary, body) {
    if (!dom.lastResult || !dom.lastResultTitle) return;
    dom.lastResultTitle.textContent = summary;
    dom.lastResult.replaceChildren();
    const payload = pickRenderPayload(body);
    dom.lastResult.appendChild(renderPayload(payload));
}

// Strip the JSON-RPC envelope down to the bit a human cares about.
function pickRenderPayload(body) {
    if (!body || typeof body !== 'object') return body;
    if (body.error) return { error: body.error };
    const result = body.result;
    if (!result || typeof result !== 'object') return result ?? body;
    // `tools/list` / `resources/list` / `prompts/list` returns { tools | resources | prompts: [...] }.
    if (Array.isArray(result.tools)) return result.tools;
    if (Array.isArray(result.resources)) return result.resources;
    if (Array.isArray(result.prompts)) return result.prompts;
    // `tools/call` returns structuredContent (preferred) or content[].
    if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
    if (Array.isArray(result.content)) return result.content;
    return result;
}

function renderPayload(payload) {
    if (Array.isArray(payload) && payload.length > 0 && payload.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
        return renderObjectArrayTable(payload);
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        // Plain `content` entries from tools/call — `[{ type: 'text', text: '…' }]` flattened to text.
        if (typeof payload.type === 'string' && typeof payload.text === 'string') {
            const pre = document.createElement('pre');
            pre.textContent = payload.text;
            return pre;
        }
        if (Object.values(payload).every(v => typeof v !== 'object' || v === null)) {
            return renderKeyValueTable(payload);
        }
    }
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(payload, null, 2);
    return pre;
}

function renderObjectArrayTable(items) {
    // Pick a small set of "interesting" columns. `name`/`title` and `description` cover the
    // tools/list, resources/list, and query-elements shapes; fall back to whatever keys exist.
    const preferred = ['name', 'title', 'description', 'id', 'type', 'elementTypeId', 'label'];
    const present = preferred.filter(key => items.some(item => key in item));
    const keys = present.length > 0 ? present : Object.keys(items[0]).slice(0, 4);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const key of keys) {
        const th = document.createElement('th');
        th.textContent = key;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const item of items) {
        const row = document.createElement('tr');
        for (const key of keys) {
            const td = document.createElement('td');
            td.className = key === keys[0] ? 'key' : 'value';
            const value = item[key];
            td.textContent = value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
}

function renderKeyValueTable(payload) {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (const [key, value] of Object.entries(payload)) {
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        keyCell.className = 'key';
        keyCell.textContent = key;
        const valueCell = document.createElement('td');
        valueCell.className = 'value';
        valueCell.textContent = value === null ? 'null' : String(value);
        row.append(keyCell, valueCell);
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
}

// ---------- info bar (server-pushed actions) ----------

function showInfoBar() {
    dom.infoBar.classList.add('visible');
    document.getElementById('server-messages-section')?.classList.remove('section-hidden');
}

function renderStatus(action) {
    const severity = (action.severity ?? 'info').toLowerCase();
    const message = (action.message ?? '').trim();
    // `{severity: 'NONE', message: ''}` is a "clear status" beat between meaningful
    // updates; render that as a quiet idle line rather than verbatim text.
    if (severity === 'none' && !message) {
        dom.statusLine.textContent = 'All quiet.';
    } else if (!message) {
        dom.statusLine.textContent = severity[0].toUpperCase() + severity.slice(1);
    } else {
        dom.statusLine.textContent = message;
    }
    showInfoBar();
}

function startProgress(action) {
    dom.progressTitle.textContent = action.title ?? 'In progress…';
    dom.progressBar.removeAttribute('value');
    dom.progressRow.style.display = 'flex';
    showInfoBar();
}

function endProgress() {
    dom.progressRow.style.display = 'none';
}

// ---------- diagram rendering ----------

function nodeCssClass(type) {
    if (type.startsWith('task:automated')) return 'diagram-node task-automated';
    if (type.startsWith('task:manual')) return 'diagram-node task-manual';
    if (type.startsWith('activityNode')) return 'diagram-node activity-node';
    return 'diagram-node';
}

function elementLabel(element) {
    if (typeof element.label === 'string' && element.label.trim()) return element.label;
    if (typeof element.name === 'string' && element.name.trim()) return element.name;
    if (typeof element.type === 'string' && element.type.includes(':')) {
        return element.type.slice(element.type.lastIndexOf(':') + 1);
    }
    return element.id;
}

// Painted geometry for a node, derived from its bounding rect. Diamonds shrink to
// 75% of the rect so they don't read as overscaled. Synchronization bars (fork/join)
// align to the long axis of the bounding rect — vertical when the rect is tall
// (workflow's canonical 10×50), horizontal when wide.
const DIAMOND_SCALE = 0.75;
const BAR_THICKNESS = 4;
function nodeShape(node) {
    const type = node.type ?? '';
    const x = node.position.x;
    const y = node.position.y;
    const w = node.size.width;
    const h = node.size.height;
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (type === 'activityNode:decision' || type === 'activityNode:merge') {
        return { kind: 'diamond', cx, cy, halfW: (w * DIAMOND_SCALE) / 2, halfH: (h * DIAMOND_SCALE) / 2 };
    }
    if (type === 'activityNode:fork' || type === 'activityNode:join') {
        if (h >= w) {
            // Vertical bar — thin column along the long (vertical) axis.
            return { kind: 'rect', x: cx - BAR_THICKNESS / 2, y, width: BAR_THICKNESS, height: h };
        }
        return { kind: 'rect', x, y: cy - BAR_THICKNESS / 2, width: w, height: BAR_THICKNESS };
    }
    return { kind: 'rect', x, y, width: w, height: h };
}

// Clip the line from the shape's center toward (fromX,fromY) to the shape's boundary,
// so edges meet the painted shape instead of disappearing into it or stopping short.
function clipLineToShape(shape, fromX, fromY) {
    if (shape.kind === 'diamond') {
        const dx = fromX - shape.cx;
        const dy = fromY - shape.cy;
        if (dx === 0 && dy === 0) return { x: shape.cx, y: shape.cy };
        // Diamond |X|/halfW + |Y|/halfH = 1 → r = 1 / (|dx|/halfW + |dy|/halfH).
        const r = 1 / (Math.abs(dx) / shape.halfW + Math.abs(dy) / shape.halfH);
        return { x: shape.cx + dx * r, y: shape.cy + dy * r };
    }
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const dx = fromX - cx;
    const dy = fromY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const scale = Math.min(shape.width / 2 / Math.abs(dx || Infinity), shape.height / 2 / Math.abs(dy || Infinity));
    return { x: cx + dx * scale, y: cy + dy * scale };
}

function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, String(value));
    }
    return node;
}

function partitionElements(elements) {
    const nodes = [];
    const edges = [];
    const nodeIndex = new Map();
    for (const element of elements) {
        const type = element.type ?? '';
        if (typeof element.sourceId === 'string' && typeof element.targetId === 'string') {
            edges.push(element);
        } else if (element.position && element.size && (type.startsWith('task') || type.startsWith('activityNode'))) {
            nodes.push(element);
            nodeIndex.set(element.id, element);
        }
    }
    return { nodes, edges, nodeIndex };
}

function computeViewBox(nodes) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const node of nodes) {
        const { x, y } = node.position;
        const { width, height } = node.size;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + width > maxX) maxX = x + width;
        if (y + height > maxY) maxY = y + height;
    }
    const padding = 20;
    const width = Math.max(maxX - minX + padding * 2, 200);
    const height = Math.max(maxY - minY + padding * 2, 100);
    return { x: minX - padding, y: minY - padding, width, height };
}

function renderDiagram(elements) {
    dom.diagram.replaceChildren();
    const { nodes, edges, nodeIndex } = partitionElements(elements);
    if (nodes.length === 0) {
        dom.diagram.classList.remove('visible');
        logEntry('error', 'No renderable nodes in diagram-model output', { elements });
        return;
    }

    const viewBox = computeViewBox(nodes);
    dom.diagram.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    const displayWidth = Math.min(viewBox.width, 960);
    dom.diagram.setAttribute('width', String(displayWidth));
    dom.diagram.setAttribute('height', String(viewBox.height * (displayWidth / viewBox.width)));

    const defs = svg('defs');
    const marker = svg('marker', { id: 'arrow', markerWidth: 10, markerHeight: 10, refX: 8, refY: 3, orient: 'auto' });
    marker.appendChild(svg('path', { d: 'M0,0 L0,6 L8,3 z', class: 'diagram-edge-arrow' }));
    defs.appendChild(marker);
    dom.diagram.appendChild(defs);

    // Precompute painted geometry once per node so edge clipping and shape painting
    // agree on where the visible boundary actually is.
    const shapes = new Map();
    for (const node of nodes) {
        shapes.set(node.id, nodeShape(node));
    }

    // Edges first so nodes paint on top. Both endpoints clip to the painted shape so
    // the arrow head lands on the shape's edge, not behind it or short of it.
    for (const edge of edges) {
        const sourceShape = shapes.get(edge.sourceId);
        const targetShape = shapes.get(edge.targetId);
        if (!sourceShape || !targetShape) continue;
        const sourceCx = sourceShape.kind === 'diamond' ? sourceShape.cx : sourceShape.x + sourceShape.width / 2;
        const sourceCy = sourceShape.kind === 'diamond' ? sourceShape.cy : sourceShape.y + sourceShape.height / 2;
        const targetCx = targetShape.kind === 'diamond' ? targetShape.cx : targetShape.x + targetShape.width / 2;
        const targetCy = targetShape.kind === 'diamond' ? targetShape.cy : targetShape.y + targetShape.height / 2;
        const start = clipLineToShape(sourceShape, targetCx, targetCy);
        const end = clipLineToShape(targetShape, sourceCx, sourceCy);
        dom.diagram.appendChild(
            svg('line', {
                x1: start.x,
                y1: start.y,
                x2: end.x,
                y2: end.y,
                class: 'diagram-edge',
                'marker-end': 'url(#arrow)'
            })
        );
    }

    for (const node of nodes) {
        const type = node.type ?? '';
        const cssClass = nodeCssClass(type);
        const shape = shapes.get(node.id);
        if (shape.kind === 'diamond') {
            const points = `${shape.cx},${shape.cy - shape.halfH} ${shape.cx + shape.halfW},${shape.cy} ${shape.cx},${shape.cy + shape.halfH} ${shape.cx - shape.halfW},${shape.cy}`;
            dom.diagram.appendChild(svg('polygon', { points, class: cssClass }));
        } else if (type.startsWith('activityNode')) {
            // Bar — flat filled rect, no inset label.
            dom.diagram.appendChild(
                svg('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: 1.5, class: cssClass })
            );
        } else {
            dom.diagram.appendChild(
                svg('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: 4, class: cssClass })
            );
            const text = svg('text', {
                x: shape.x + shape.width / 2,
                y: shape.y + shape.height / 2,
                class: 'diagram-label'
            });
            text.textContent = elementLabel(node);
            dom.diagram.appendChild(text);
        }
    }

    dom.diagram.classList.add('visible');
}

async function fetchAndRenderDiagram() {
    const result = await mcpToolCall('diagram-model', { sessionId: CLIENT_SESSION_ID }, '(diagram-model)', { internal: true });
    const elements = result.body?.result?.structuredContent?.elements;
    if (Array.isArray(elements)) {
        renderDiagram(elements);
    } else {
        logEntry('error', 'diagram-model response missing structuredContent.elements', result.body);
    }
}

// Re-render on every `updateModel` push (debounced). `updateModel` is the canonical
// GLSP signal carrying the new model root — Sprotty-based clients swap the root on
// this action; we re-fetch `diagram-model` for the same effect.
let updateRenderTimer = 0;
function scheduleModelRender() {
    if (!mcpSessionId || updateRenderTimer) return;
    updateRenderTimer = setTimeout(() => {
        updateRenderTimer = 0;
        fetchAndRenderDiagram().catch(err => logEntry('error', 'auto re-render on updateModel failed', String(err)));
    }, DIRTY_RENDER_DEBOUNCE_MS);
}

// ---------- boot ----------

let glsp;

async function bootGlsp(worker) {
    glsp = new GlspClient(worker);
    glsp.onAction(action => {
        switch (action.kind) {
            case 'status':
                renderStatus(action);
                break;
            case 'updateModel':
                scheduleModelRender();
                break;
            case 'setDirtyState':
                if (dom.diagramDirty) {
                    dom.diagramDirty.hidden = !action.isDirty;
                }
                break;
            case 'startProgress':
                startProgress(action);
                break;
            case 'endProgress':
                endProgress();
                break;
            case 'requestBounds':
                glsp.dispatchAction(CLIENT_SESSION_ID, buildComputedBoundsAction(action));
                break;
            default:
                logEntry('response', `← server-pushed action ${action.kind}`, action);
        }
    });

    await glsp.initialize('workflow-server-bundled-web-smoke', { name: 'workflow-glsp', route: MCP_URL });

    dom.glspSession.value = CLIENT_SESSION_ID;
    await glsp.initializeClientSession(CLIENT_SESSION_ID, DIAGRAM_TYPE, CLIENT_ACTION_KINDS);

    // Trigger model load. `WorkflowMockModelStorage` ignores the URI and always serves
    // its bundled example1.json, so any non-empty `sourceUri` works.
    logEntry('request', '→ GLSP process(requestModel)', { sourceUri: 'example1.json' });
    glsp.dispatchAction(CLIENT_SESSION_ID, {
        kind: 'requestModel',
        options: { sourceUri: 'example1.json', diagramType: DIAGRAM_TYPE }
    });
}

async function bootSw(worker) {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported in this browser');
    }
    await navigator.serviceWorker.register('./mcp-service-worker.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
        // First registration: SW activated but the page isn't controlled yet. With
        // `skipWaiting`/`clients.claim` this usually fires within a tick.
        await new Promise(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        });
    }
    // One MessageChannel; the page holds neither end. Port 1 goes to the Service Worker
    // (incoming MCP fetches), port 2 to the Web Worker (MCP request handler).
    const channel = new MessageChannel();
    navigator.serviceWorker.controller.postMessage({ type: 'mcp-init-port' }, [channel.port1]);
    worker.postMessage({ type: 'mcp-init-port' }, [channel.port2]);
}

async function boot() {
    // Cache-bust the worker bundle URL per page load. Browsers HTTP-cache `new Worker(url)`
    // fetches; without this, rebuilding the bundle takes effect only after a Service Worker
    // unregister or cache flush.
    const worker = new Worker(`./wf-glsp-server-webworker.js?v=${Date.now()}`);
    worker.addEventListener('error', event => logEntry('error', 'Worker error', event.message ?? String(event)));

    try {
        await Promise.all([bootGlsp(worker), bootSw(worker)]);
        dom.bootStatus.textContent = `Connected. Workflow session ${CLIENT_SESSION_ID} is open.`;
        dom.bootStatus.classList.add('ready');
        setSystemState('ready', 'Ready');
        dom.btnMcpInit.disabled = false;
    } catch (err) {
        dom.bootStatus.textContent = `Boot failed — ${err.message ?? err}`;
        dom.bootStatus.classList.add('failed');
        setSystemState('failed', 'Failed');
        logEntry('error', 'Boot failed', String(err));
    }
}

// ---------- button wiring ----------

dom.btnMcpInit.addEventListener('click', async () => {
    dom.btnMcpInit.disabled = true;
    const result = await mcpFetch(
        {},
        {
            jsonrpc: '2.0',
            id: rpcId++,
            method: 'initialize',
            params: {
                protocolVersion: MCP_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'glsp-mcp-smoke', version: '0.0.1' }
            }
        },
        '(initialize)'
    );
    mcpSessionId = result.headers['mcp-session-id'] ?? '';
    if (!mcpSessionId) {
        logEntry('error', 'No mcp-session-id in response headers', result.headers);
        dom.btnMcpInit.disabled = false;
        return;
    }
    dom.mcpSession.value = mcpSessionId;
    // Demote the primary treatment once init has succeeded — every action is now equal.
    dom.btnMcpInit.classList.remove('primary');
    dom.btnMcpTools.disabled = false;
    dom.btnMcpSessionInfo.disabled = false;
    dom.btnMcpElementTypes.disabled = false;
    dom.btnMcpQuery.disabled = false;
    dom.btnMcpValidate.disabled = false;
    dom.btnMcpCreate.disabled = false;
    dom.btnMcpTerminate.disabled = false;
    // Move/Delete activate after the first create; Undo/Redo follow the dispatched-commands stack.
    await mcpFetch(mcpHeaders(), { jsonrpc: '2.0', method: 'notifications/initialized' }, '(initialized)');
    await fetchAndRenderDiagram();
    dom.btnMcpInit.disabled = false;
});

dom.btnMcpTools.addEventListener('click', () => {
    mcpFetch(mcpHeaders(), { jsonrpc: '2.0', id: rpcId++, method: 'tools/list' }, '(tools/list)');
});

dom.btnMcpSessionInfo.addEventListener('click', () => {
    mcpToolCall('session-info', {}, '(session-info)');
});

dom.btnMcpElementTypes.addEventListener('click', () => {
    mcpToolCall('element-types', { sessionId: CLIENT_SESSION_ID }, '(element-types)');
});

dom.btnMcpQuery.addEventListener('click', () => {
    mcpToolCall('query-elements', { sessionId: CLIENT_SESSION_ID }, '(query-elements)');
});

dom.btnMcpValidate.addEventListener('click', () => {
    mcpToolCall('validate-diagram', { sessionId: CLIENT_SESSION_ID }, '(validate-diagram)');
});

dom.btnMcpUndo.addEventListener('click', async () => {
    const count = undoStack[undoStack.length - 1];
    if (!count) return;
    dom.btnMcpUndo.disabled = true;
    await mcpToolCall('undo', { sessionId: CLIENT_SESSION_ID, commandsToUndo: count }, `(undo · ${count})`);
    undoStack.pop();
    redoStack.push(count);
    updateUndoRedoButtons();
});
dom.btnMcpRedo.addEventListener('click', async () => {
    const count = redoStack[redoStack.length - 1];
    if (!count) return;
    dom.btnMcpRedo.disabled = true;
    await mcpToolCall('redo', { sessionId: CLIENT_SESSION_ID, commandsToRedo: count }, `(redo · ${count})`);
    redoStack.pop();
    undoStack.push(count);
    updateUndoRedoButtons();
});

// Each click drops a new manual task with an incrementing position so repeated clicks
// don't overlap. The `updateModel` push from the server auto-triggers a re-render.
let createOffset = 0;
const recentTaskIds = [];
// Each mutating tool reports `dispatchedCommands` — the number of underlying GLSP commands the
// call produced (e.g. create-with-label = 2 commands). Track per-call counts so Undo / Redo can
// roll back / replay a full user action instead of just its last sub-command.
const undoStack = [];
const redoStack = [];
function updateUndoRedoButtons() {
    dom.btnMcpUndo.disabled = undoStack.length === 0;
    dom.btnMcpRedo.disabled = redoStack.length === 0;
}
function trackDispatched(toolResult) {
    const count = toolResult?.body?.result?.structuredContent?.dispatchedCommands;
    if (typeof count === 'number' && count > 0) {
        undoStack.push(count);
        redoStack.length = 0;
        updateUndoRedoButtons();
    }
}
function rememberCreatedTaskIds(toolResult) {
    const created = toolResult?.body?.result?.structuredContent?.createdNodes;
    if (!Array.isArray(created)) return;
    for (const node of created) {
        // ElementIdentitySchema fields: `id` is the (aliased) element id.
        if (node && typeof node.id === 'string') {
            recentTaskIds.push(node.id);
        }
    }
    if (recentTaskIds.length > 0) {
        dom.btnMcpMove.disabled = false;
        dom.btnMcpDelete.disabled = false;
    }
}
dom.btnMcpCreate.addEventListener('click', async () => {
    dom.btnMcpCreate.disabled = true;
    createOffset += 1;
    const result = await mcpToolCall(
        'create-nodes',
        {
            sessionId: CLIENT_SESSION_ID,
            nodes: [
                {
                    elementTypeId: 'task:manual',
                    position: { x: 40, y: 30 + createOffset * 50 },
                    text: `Task ${createOffset}`
                }
            ]
        },
        '(create-nodes)'
    );
    rememberCreatedTaskIds(result);
    trackDispatched(result);
    dom.btnMcpCreate.disabled = false;
});

// Move/delete target the most recently created task. Both rely on `updateModel`
// for the diagram re-render.
dom.btnMcpMove.addEventListener('click', async () => {
    const elementId = recentTaskIds[recentTaskIds.length - 1];
    if (!elementId) return;
    dom.btnMcpMove.disabled = true;
    const result = await mcpToolCall(
        'modify-nodes',
        {
            sessionId: CLIENT_SESSION_ID,
            nodes: [{ elementId, position: { x: 220, y: 30 + createOffset * 50 } }]
        },
        '(modify-nodes · move)'
    );
    trackDispatched(result);
    dom.btnMcpMove.disabled = false;
});
dom.btnMcpDelete.addEventListener('click', async () => {
    const elementId = recentTaskIds.pop();
    if (!elementId) return;
    dom.btnMcpDelete.disabled = true;
    const result = await mcpToolCall('delete-elements', { sessionId: CLIENT_SESSION_ID, elementIds: [elementId] }, '(delete-elements)');
    trackDispatched(result);
    if (recentTaskIds.length === 0) {
        dom.btnMcpMove.disabled = true;
        dom.btnMcpDelete.disabled = true;
    } else {
        dom.btnMcpDelete.disabled = false;
    }
});

// Terminate the current MCP session via the spec's `DELETE /mcp` op. After this the server
// drops the per-session state; subsequent tool calls fail with 404 until the user re-initialises.
dom.btnMcpTerminate.addEventListener('click', async () => {
    if (!mcpSessionId) return;
    dom.btnMcpTerminate.disabled = true;
    await mcpFetch(mcpHeaders(), undefined, '(terminate)', { method: 'DELETE' });
    mcpSessionId = '';
    dom.mcpSession.value = '';
    // Tool buttons can no longer succeed against this session; the user must re-Initialize.
    dom.btnMcpTools.disabled = true;
    dom.btnMcpSessionInfo.disabled = true;
    dom.btnMcpElementTypes.disabled = true;
    dom.btnMcpQuery.disabled = true;
    dom.btnMcpValidate.disabled = true;
    dom.btnMcpCreate.disabled = true;
    dom.btnMcpMove.disabled = true;
    dom.btnMcpDelete.disabled = true;
    dom.btnMcpUndo.disabled = true;
    dom.btnMcpRedo.disabled = true;
    dom.btnMcpInit.disabled = false;
    dom.btnMcpInit.classList.add('primary');
});

dom.btnClear.addEventListener('click', () => {
    dom.log.innerHTML = '';
});

boot();
