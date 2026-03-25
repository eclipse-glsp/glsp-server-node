# @eclipse-glsp/server-mcp

An extension of the [GLSP Node Server](https://github.com/eclipse-glsp/glsp-server-node) that exposes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server alongside the existing GLSP server. This allows AI agents and LLM-based tools to interact with graphical diagram models using the standardized MCP interface.

## Table of Contents

-   [Purpose](#purpose)
-   [Usage and Extension](#usage-and-extension)
    -   [Installation](#installation)
    -   [Integrating into a GLSP Server](#integrating-into-a-glsp-server)
    -   [Server Configuration](#server-configuration)
    -   [Extending with Custom Handlers](#extending-with-custom-handlers)
        -   [Adding a Custom Tool](#adding-a-custom-tool)
        -   [Adding a Custom Resource](#adding-a-custom-resource)
        -   [Overriding an Existing Handler](#overriding-an-existing-handler)
    -   [Resource vs. Tool Mode](#resource-vs-tool-mode)
    -   [ID Aliasing](#id-aliasing)
-   [Tools and Resources Reference](#tools-and-resources-reference)
    -   [Resources](#resources)
    -   [Tools](#tools)

---

## Purpose

This package bridges GLSP-based graphical modeling environments with AI agents through the Model Context Protocol. Once integrated into a GLSP Node server, it starts an HTTP-based MCP server that provides:

-   **Resources** — Read-only structured data about active sessions, diagram models, element types, and diagram screenshots.
-   **Tools** — Read/write operations to create, modify, delete, validate, and navigate diagram elements.

However, depending on the used parameters those resources are exposed as MCP tools as well, because not every client is able to deal with MCP resources properly.

The MCP server is initialized as part of the GLSP server startup sequence and creates a new MCP session for each connecting MCP client. Each session runs a preconfigured AI agent persona (the _GLSP Modeling Agent_) that guides AI clients toward correct and safe usage of the modeling tools. It should be noted that the server startup sequence does not mean simply starting a server process, but rather that some kind of GLSP client starts the initialization.

---

## Usage and Extension

### Installation

```bash
yarn add @eclipse-glsp/server-mcp
# or
npm install @eclipse-glsp/server-mcp
```

### Integrating into a GLSP Server

Load the MCP container module in your GLSP server's DI configuration:

```typescript
import { GModelStorage, WebSocketServerLauncher, createAppModule } from '@eclipse-glsp/server/node';
import { Container } from 'inversify';
import { configureMcpInitModule, configureMcpServerModule } from '@eclipse-glsp/server-mcp';

const appContainer = new Container();
appContainer.load(createAppModule(options));

const mcpInitModule = configureMcpInitModule(); // needs to be part of `configureDiagramModule` to ensure correct initialization
const serverModule = new MyServerModule().configureDiagramModule(new MyDiagramModule(() => GModelStorage), mcpInitModule);

const launcher = appContainer.resolve(WebSocketServerLauncher);
const mcpModule = configureMcpServerModule(); // must not be part of `configureDiagramModule` to ensure MCP server launch
launcher.configure(serverModule, mcpModule);
```

The `configureInitModule()` is required to wire up the server-to-client action handlers that enable the `diagram-png` and `get-selection` features.

### Server Configuration

The MCP server is configured through the GLSP `InitializeParameters`. The client (e.g., a Theia or VS Code extension) must include an `McpServerConfiguration` object in the initialize request parameters under the key `mcpServer`.

The following options are supported with their defaults:

| Option              | Type      | Default           | Description                                                                      |
| ------------------- | --------- | ----------------- | -------------------------------------------------------------------------------- |
| `port`              | `number`  | `60000`           | Port the MCP HTTP server listens on                                              |
| `host`              | `string`  | `'127.0.0.1'`     | Host/interface the server binds to                                               |
| `route`             | `string`  | `'/glsp-mcp'`     | HTTP route path for the MCP endpoint                                             |
| `name`              | `string`  | `'glspMcpServer'` | Name reported in the MCP server handshake                                        |
| `options.resources` | `boolean` | `false`           | Whether to expose data handlers as MCP **resources** (true) or **tools** (false) |
| `options.aliasIds`  | `boolean` | `true`            | Whether to replace raw IDs with shorter integer aliases in all responses         |

Once started, the server URL is reported back in the `InitializeResult` under `result.mcpServer.url`, e.g. `http://127.0.0.1:60000/glsp-mcp`.

The MCP server uses the **Streamable HTTP transport** and supports session resumability via `mcp-session-id` headers (GET for SSE, POST for RPC, DELETE for session termination).

### Extending with Custom Handlers

All handlers are registered through InversifyJS DI. The two extension points are `McpToolHandler` and `McpResourceHandler`. When bound against the symbols of the same name, then they will be automatically discovered and registered.

#### Adding a Custom Tool

```typescript
import { inject, injectable } from 'inversify';
import { McpToolHandler, GLSPMcpServer } from '@eclipse-glsp/server-mcp';
import { ClientSessionManager, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import * as z from 'zod/v4';

@injectable()
export class MyCustomMcpToolHandler implements McpToolHandler {
    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'my-tool',
            {
                description: 'Description of what this tool does.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID'),
                    myParam: z.string().describe('Some parameter')
                }
            },
            params => this.handle(params)
        );
    }

    async handle(params: { sessionId: string; myParam: string }): Promise<CallToolResult> {
        // access relevant services via the session container
        const session = this.clientSessionManager.getSession(sessionId);
        const modelState = session.container.get<ModelState>(ModelState);

        // ... implement tool logic ...
        return { isError: false, content: [{ type: 'text', text: 'Done' }] };
    }
}

// In your ContainerModule:
import { bindAsService } from '@eclipse-glsp/server';

bindAsService(bind, McpToolHandler, MyCustomMcpToolHandler);
```

#### Adding a Custom Resource

```typescript
import { inject, injectable } from 'inversify';
import {
    McpResourceHandler,
    GLSPMcpServer,
    ResourceHandlerResult,
    createResourceResult,
    createResourceToolResult
} from '@eclipse-glsp/server-mcp';

@injectable()
export class MyCustomMcpResourceHandler implements McpResourceHandler {
    registerResource(server: GLSPMcpServer): void {
        server.registerResource(
            'my-resource',
            'glsp://my-resource',
            { title: 'My Resource', description: 'A custom resource', mimeType: 'text/markdown' },
            async () => createResourceResult(await this.handle({}))
        );
    }

    registerTool(server: GLSPMcpServer): void {
        server.registerTool('my-resource', { description: '...' }, async () => createResourceToolResult(await this.handle({})));
    }

    async handle(params: Record<string, any>): Promise<ResourceHandlerResult> {
        return {
            content: { uri: 'glsp://my-resource', mimeType: 'text/markdown', text: '# My Resource' },
            isError: false
        };
    }
}

// In your ContainerModule:
import { bindAsService } from '@eclipse-glsp/server';

bindAsService(bind, McpResourceHandler, MyCustomMcpResourceHandler);
```

#### Overriding an Existing Handler

Use InversifyJS `rebind` to replace a built-in handler with your own subclass:

```typescript
// Override a tool handler
rebind(CreateNodesMcpToolHandler).to(MyCreateNodesMcpToolHandler).inSingletonScope();

// Override a resource handler
rebind(SessionsListMcpResourceHandler).to(MySessionsListMcpResourceHandler).inSingletonScope();
```

### Resource vs. Tool Mode

By default (`options.resources: false`), all data handlers (sessions list, element types, diagram model, diagram PNG) are registered as **tools**. This maximizes compatibility with MCP clients that do not yet support the resources protocol.

Set `options.resources: true` to register these handlers as proper MCP **resources** instead, which enables URI-based access patterns such as `glsp://sessions` or `glsp://diagrams/{sessionId}/model`.

### ID Aliasing

When `options.aliasIds: true` (default), the server replaces verbose element IDs (e.g., UUIDs) with short integer strings (e.g., `"1"`, `"2"`) in all tool and resource responses. This reduces token consumption when working with large models. The aliases are scoped per session and are resolved back to real IDs transparently before any operation is dispatched.

However, this means that there is certain caution required when implementing MCP handlers, as it is the responsibility of the developer to ensure that the IDs are correctly resolved. In general, each received ID is an alias that needs to be mapped back to the real ID, while for each ID that is part of the response, an alias has to be created first.

```typescript
// Get the `McpIdAliasService` from the session container
const mcpIdAliasService = session.container.get<McpIdAliasService>(McpIdAliasService);

// Look-up the real ID
const realId = mcpIdAliasService.lookup(sessionId, aliasId);

// Alias a real ID
const aliasId = mcpIdAliasService.alias(sessionId, realId);
```

---

## Tools and Resources Reference

### Resources

Resources are URI-addressable read-only data endpoints. When `options.resources` is `false` (default), they are exposed as tools instead — see [Resource vs. Tool Mode](#resource-vs-tool-mode).

| Name            | URI                                   | MIME Type       | Description                                                                                                                                                           |
| --------------- | ------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions-list` | `glsp://sessions`                     | `text/markdown` | Lists all active GLSP client sessions with their session ID, diagram type, source URI, and read-only status.                                                          |
| `element-types` | `glsp://types/{diagramType}/elements` | `text/markdown` | Lists all creatable node and edge types for a given diagram type. Requires at least one active session of that type. Returns a Markdown table of type IDs and labels. |
| `diagram-model` | `glsp://diagrams/{sessionId}/model`   | `text/markdown` | Returns the complete serialized GLSP model for a session as a Markdown structure, including all nodes, edges, and their properties.                                   |
| `diagram-png`   | `glsp://diagrams/{sessionId}/png`     | `image/png`     | Returns a base64-encoded PNG screenshot of the current diagram state. Requires a connected frontend client. Times out after 5 seconds if no response is received.     |

---

### Tools

All tools that modify the diagram require an explicit user approval step (as noted in their descriptions). Tools that query state are read-only.

#### `sessions-list`

Lists all active GLSP client sessions.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| _(none)_  |      |          |             |

**Returns:** Markdown table with columns `sessionId`, `diagramType`, `sourceUri`, `readOnly`.

---

#### `element-types`

Discovers all creatable element type IDs for a diagram type.

| Parameter     | Type     | Required | Description                                    |
| ------------- | -------- | -------- | ---------------------------------------------- |
| `diagramType` | `string` | Yes      | The diagram type to query (e.g., `"workflow"`) |

**Returns:** Markdown document with separate tables for node types and edge types, each with columns `id` and `label`.

---

#### `diagram-model`

Retrieves the complete serialized model for a session.

| Parameter   | Type     | Required | Description         |
| ----------- | -------- | -------- | ------------------- |
| `sessionId` | `string` | Yes      | Session ID to query |

**Returns:** Markdown-formatted model tree including all element IDs, types, bounds, and properties.

---

#### `diagram-png`

Renders and returns a PNG screenshot of the diagram.

| Parameter   | Type     | Required | Description          |
| ----------- | -------- | -------- | -------------------- |
| `sessionId` | `string` | Yes      | Session ID to render |

**Returns:** PNG image data. Times out after 5 seconds if the frontend does not respond.

---

#### `diagram-elements`

Retrieves serialized details for specific diagram elements.

| Parameter    | Type       | Required | Description                        |
| ------------ | ---------- | -------- | ---------------------------------- |
| `sessionId`  | `string`   | Yes      | Session ID containing the elements |
| `elementIds` | `string[]` | Yes      | One or more element IDs to query   |

**Returns:** Markdown-formatted representation of the requested elements and their properties.

---

#### `create-nodes`

Creates one or more new nodes in the diagram.

| Parameter               | Type                       | Required | Description                                                             |
| ----------------------- | -------------------------- | -------- | ----------------------------------------------------------------------- |
| `sessionId`             | `string`                   | Yes      | Session ID where nodes should be created                                |
| `nodes`                 | `object[]`                 | Yes      | Array of node descriptors (minimum 1)                                   |
| `nodes[].elementTypeId` | `string`                   | Yes      | Element type ID (use `element-types` to discover valid IDs)             |
| `nodes[].position`      | `{ x: number, y: number }` | Yes      | Absolute diagram coordinates                                            |
| `nodes[].text`          | `string`                   | No       | Initial label text (if the type supports labels)                        |
| `nodes[].containerId`   | `string`                   | No       | ID of a container/parent element; uses the diagram root if not provided |
| `nodes[].args`          | `Record<string, any>`      | No       | Additional type-specific creation arguments                             |

**Returns:** List of newly created element IDs and any errors for failed creations.

---

#### `create-edges`

Creates one or more new edges connecting diagram elements.

| Parameter                 | Type                         | Required | Description                                              |
| ------------------------- | ---------------------------- | -------- | -------------------------------------------------------- |
| `sessionId`               | `string`                     | Yes      | Session ID where edges should be created                 |
| `edges`                   | `object[]`                   | Yes      | Array of edge descriptors (minimum 1)                    |
| `edges[].elementTypeId`   | `string`                     | Yes      | Edge type ID (use `element-types` to discover valid IDs) |
| `edges[].sourceElementId` | `string`                     | Yes      | ID of the source element                                 |
| `edges[].targetElementId` | `string`                     | Yes      | ID of the target element                                 |
| `edges[].routingPoints`   | `{ x: number, y: number }[]` | No       | Optional intermediate routing points                     |
| `edges[].args`            | `Record<string, any>`        | No       | Additional type-specific creation arguments              |

**Returns:** List of newly created edge IDs and any errors for failed creations.

---

#### `delete-elements`

Deletes one or more elements (nodes or edges) from the diagram. Dependent elements (e.g., edges connected to a deleted node) are removed automatically.

| Parameter    | Type       | Required | Description                                 |
| ------------ | ---------- | -------- | ------------------------------------------- |
| `sessionId`  | `string`   | Yes      | Session ID where elements should be deleted |
| `elementIds` | `string[]` | Yes      | Array of element IDs to delete (minimum 1)  |

**Returns:** Count of deleted elements including automatically removed dependents.

---

#### `modify-nodes`

Modifies position, size, and/or label of one or more existing nodes.

| Parameter             | Type                                | Required | Description                                     |
| --------------------- | ----------------------------------- | -------- | ----------------------------------------------- |
| `sessionId`           | `string`                            | Yes      | Session ID                                      |
| `changes`             | `object[]`                          | Yes      | Array of change descriptors (minimum 1)         |
| `changes[].elementId` | `string`                            | Yes      | ID of the node to modify                        |
| `changes[].position`  | `{ x: number, y: number }`          | No       | New absolute position                           |
| `changes[].size`      | `{ width: number, height: number }` | No       | New size                                        |
| `changes[].text`      | `string`                            | No       | New label text (if the element supports labels) |

**Returns:** Number of modified nodes and commands dispatched.

---

#### `modify-edges`

Modifies the source/target connection or routing points of one or more existing edges.

| Parameter                   | Type                         | Required | Description                                                              |
| --------------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `sessionId`                 | `string`                     | Yes      | Session ID                                                               |
| `changes`                   | `object[]`                   | Yes      | Array of change descriptors (minimum 1)                                  |
| `changes[].elementId`       | `string`                     | Yes      | ID of the edge to modify                                                 |
| `changes[].sourceElementId` | `string`                     | No       | New source element ID (must be provided together with `targetElementId`) |
| `changes[].targetElementId` | `string`                     | No       | New target element ID (must be provided together with `sourceElementId`) |
| `changes[].routingPoints`   | `{ x: number, y: number }[]` | No       | New routing points; an empty array removes all routing points            |

**Note:** Reconnection (`sourceElementId`/`targetElementId`) and routing point changes are mutually exclusive per edge change entry.

**Returns:** Number of successfully modified edges and any errors.

---

#### `save-model`

Saves the diagram model to persistent storage.

| Parameter   | Type     | Required | Description                                                                 |
| ----------- | -------- | -------- | --------------------------------------------------------------------------- |
| `sessionId` | `string` | Yes      | Session ID where the model should be saved                                  |
| `fileUri`   | `string` | No       | Optional destination URI; if omitted, saves to the original source location |

**Returns:** Success message or `"No changes to save"` if the model is not dirty.

---

#### `validate-diagram`

Runs validation on specific elements or the entire model and returns markers.

| Parameter    | Type                | Required | Description                                                                           |
| ------------ | ------------------- | -------- | ------------------------------------------------------------------------------------- |
| `sessionId`  | `string`            | Yes      | Session ID to validate                                                                |
| `elementIds` | `string[]`          | No       | Element IDs to validate; if omitted, validates the entire model from the root         |
| `reason`     | `"batch" \| "live"` | No       | Validation mode: `"batch"` for thorough, `"live"` for incremental (default: `"live"`) |

**Returns:** Markdown table of validation markers with severity (error/warning/info), element ID, and message.

**Note:** Returns an error if no `ModelValidator` is configured for the diagram type.

---

#### `undo`

Undoes one or more recent commands on the command stack.

| Parameter        | Type     | Required | Description                            |
| ---------------- | -------- | -------- | -------------------------------------- |
| `sessionId`      | `string` | Yes      | Session ID                             |
| `commandsToUndo` | `number` | Yes      | Number of commands to undo (minimum 1) |

**Returns:** `"Undo successful"` or an error if nothing can be undone.

---

#### `redo`

Reapplies one or more previously undone commands.

| Parameter        | Type     | Required | Description                            |
| ---------------- | -------- | -------- | -------------------------------------- |
| `sessionId`      | `string` | Yes      | Session ID                             |
| `commandsToRedo` | `number` | Yes      | Number of commands to redo (minimum 1) |

**Returns:** `"Redo successful"` or an error if nothing can be redone.

---

#### `get-selection`

Queries the element IDs of all currently selected elements in the connected UI.

| Parameter   | Type     | Required | Description         |
| ----------- | -------- | -------- | ------------------- |
| `sessionId` | `string` | Yes      | Session ID to query |

**Returns:** List of selected element IDs. Times out after 5 seconds if the frontend does not respond.

---

#### `change-view`

Changes the viewport of the session's associated UI client.

| Parameter        | Type                                                          | Required | Description                                                          |
| ---------------- | ------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `sessionId`      | `string`                                                      | Yes      | Session ID                                                           |
| `viewportAction` | `"fit-to-screen" \| "center-on-elements" \| "reset-viewport"` | Yes      | The viewport change to apply                                         |
| `elementIds`     | `string[]`                                                    | No       | Elements to center on or fit; if omitted, the entire diagram is used |

**Returns:** `"Viewport successfully changed"` or an error.

---

### Not Registered by Default

#### `request-layout` _(optional)_

Triggers automatic layout computation for the diagram. This tool is **not registered by default** because it requires a `LayoutEngine` to be present in the specific GLSP implementation. To enable it, bind `RequestLayoutMcpToolHandler` as an `McpToolHandler` in your container module.

```typescript
bindAsService(bind, McpToolHandler, RequestLayoutMcpToolHandler);
```

---

## License

EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
