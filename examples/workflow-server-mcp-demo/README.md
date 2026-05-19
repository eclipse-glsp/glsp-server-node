# Workflow Server MCP Demo (browser)

A browser demo for the `@eclipse-glsp/server-mcp` portable Fetch handler. The page opens a
workflow GLSP session inside an in-page Web Worker and drives the MCP server through a
Service Worker that intercepts `fetch('/mcp', …)` and proxies the request to the Worker via
`MessageChannel`.

This package is **private** — it ships nothing; it's a local demo and manual test bench for
the portable handler.

## Why only a browser demo?

The browser variant needs a custom harness because **external MCP clients can't reach an
in-page launcher**: a browser tab doesn't accept inbound network traffic. The Service Worker
in this demo is what makes the in-page launcher reachable to a same-origin MCP client.

For the **Node variant**, no demo is needed in this repo — the launcher binds a real HTTP
listener and announces its URL via stdout (`[GLSP-MCP-Server]:Ready. {…}`). Point any MCP
client at that URL:

-   The official **[MCP Inspector](https://github.com/modelcontextprotocol/inspector)** is the
    best manual debug tool — runs as a local web UI and lets you exercise tools, prompts and
    resources interactively.
-   **Claude Code**, **Cursor**, or any other MCP-aware client also work.

The Node path is additionally covered by the automated end-to-end spec at
`packages/server-mcp/src/node/server/mcp-http-transport-e2e.spec.ts`, which runs an MCP SDK
`Client` over real HTTP against the launcher.

## Running

From the repository root:

```bash
yarn workspace @eclipse-glsp-examples/workflow-server build
yarn workspace @eclipse-glsp-examples/workflow-server-mcp-demo start
```

The `start` script copies the worker bundle from
`@eclipse-glsp-examples/workflow-server-bundled-web`, builds the page-side bundle, and serves
the directory on `http://localhost:8000/`.

Open `http://localhost:8000/` in a Chromium-based browser. Step through the buttons
top-to-bottom; the workflow auto-renders once MCP is initialized, and **Create task**
mutates the live session.

## What it exercises

1. The page acts as a minimal GLSP JSON-RPC client over `postMessage` to the in-page Web
   Worker (using `vscode-jsonrpc/browser`, bundled).
2. GLSP `initialize` carries `mcpServer: {}` — the Worker's per-connection child container
   activates `BrowserMcpServerModule`'s launcher as a `GLSPServerInitializer`.
3. `initializeClientSession` opens a real workflow GLSP session with
   `diagramType: workflow-diagram`.
4. A Service Worker (`mcp-service-worker.js`) intercepts `fetch('/mcp', …)` and proxies the
   request through a `MessageChannel` to the Worker.
5. MCP tools (`initialize`, `tools/list`, `session-info`, `query-elements`, `diagram-model`,
   `create-nodes`) round-trip end-to-end against the live session.

The on-page SVG is a minimal schematic renderer — **not** the GLSP client; its only purpose
is to make the MCP handlers' output visible so the demo can be eyeballed end-to-end.

## Hard reset

If a stale Service Worker is misbehaving: DevTools → Application → Service Workers →
Unregister, then close the tab and re-open. The page's Worker bundle URL is cache-busted per
load, but the SW itself updates only on full lifecycle restart.
