# @eclipse-glsp/server-mcp

> **Status: Experimental.** The MCP integration is under active development. Option names, schema shapes, and handler contracts MAY change in minor releases until the feature graduates from experimental status. Pin the package version in adopter projects; track release notes for breaking changes.

An extension of the [GLSP Node Server](https://github.com/eclipse-glsp/glsp-server-node) that exposes a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server alongside the existing GLSP server. This allows AI agents and LLM-based tools to interact with graphical diagram models using the standardized MCP interface.

## What it provides

-   **Tools** — Read/query and read/write operations to inspect, create, modify, delete, validate, and navigate diagram elements (and the active sessions themselves).
-   **Resources** — URI-addressable read-only data; in the default ship-set this is `diagram-png` only (the rendered diagram screenshot, useful as embeddable image content). Other read endpoints ship as plain tools because in-the-wild MCP clients support tools more reliably than resources — see [Resource vs. Tool Mode](./ARCHITECTURE.md#resource-vs-tool-mode).
-   **Prompts** — User-invokable templates (slash-command-style) that frame multi-step agent tasks against the diagram.

The MCP server is initialized as part of the GLSP server startup sequence and creates a new MCP session for each connecting MCP client. Each session runs a preconfigured AI agent persona (the _GLSP Modeling Agent_) that guides AI clients toward correct and safe usage of the modeling tools. It should be noted that the server startup sequence does not mean simply starting a server process, but rather that some kind of GLSP client starts the initialization.

## Installation

```bash
yarn add @eclipse-glsp/server-mcp
# or
npm install @eclipse-glsp/server-mcp
```

## Integrating into a GLSP Server

Load the MCP container modules in your GLSP server's DI configuration:

```typescript
import { GModelStorage, WebSocketServerLauncher, createAppModule } from '@eclipse-glsp/server/node';
import { Container } from 'inversify';
import { DefaultMcpDiagramModule, DefaultMcpServerModule } from '@eclipse-glsp/server-mcp';

const appContainer = new Container();
appContainer.load(createAppModule(options));

// Per-session bindings — must be part of `configureDiagramModule`.
const mcpDiagramModule = new DefaultMcpDiagramModule();
const serverModule = new MyServerModule().configureDiagramModule(new MyDiagramModule(() => GModelStorage), mcpDiagramModule);

const launcher = appContainer.resolve(WebSocketServerLauncher);
// Launcher-level bindings — must not be part of `configureDiagramModule`.
launcher.configure(serverModule, new DefaultMcpServerModule());
```

The two modules are deliberately separate because they bind into different container scopes:

-   `DefaultMcpDiagramModule` is mounted inside `configureDiagramModule`, so each `ClientSession.container` gets its own per-session services (`McpIdAliasService`, `McpModelSerializer`, the diagram-scope handler registries).
-   `DefaultMcpServerModule` is mounted at the launcher container, so the MCP HTTP server, the option holder, and the server-scope tool/resource handlers live as launcher singletons.

The MCP server itself is started lazily on the first GLSP `InitializeAction` that carries an `mcpServer` configuration.

## Further reading

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the architecture, security model, configuration surface, deployment guidance, and the extension cookbook. The workflow example (`examples/workflow-server`) is the canonical reference for adopter wiring; each shipped handler carries an LLM-facing `description` field that doubles as developer-facing documentation.

## License

EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
