# GLSP Server [![Build Status](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-server-node/job/main/badge/icon)](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-server-node/job/main/)

[![Build Status](https://img.shields.io/github/actions/workflow/status/eclipse-glsp/glsp-server-node/ci.yml?branch=main&label=build)](https://github.com/eclipse-glsp/glsp-server-node/actions/workflows/ci.yml)
Contains the code for the Typescript-based framework to create [GLSP](https://github.com/eclipse-glsp/glsp) server components.
The implementation of this server is aligned with the default Java based [GLSP Server](https://github.com/eclipse-glsp/glsp-server-node).

The server consists of three components:

-   [`@eclipse-glsp/server`](packages/server/) The base framework for building GLSP servers
-   [`@eclipse-glsp/graph`](packages/graph/) The Typescript based implementation of the graphical model used in GLSP (GModel).
-   [`@eclipse-glsp-examples/workflow-server`](examples/workflow-server) GLSP example server using the workflow model.

The main target environment is node, nevertheless, all components are implemented in an ismorphic fashion and also provide
an entrypoint to target browser environments (e.g. running the server in a web worker)

## Build

Install dependencies and build via

```console
yarn
```

Only build via

```console
yarn build
```

Lint packages via

```console
yarn lint
```

or do all of the above via

```console
yarn all
```

## Testing

### Unit tests

To execute all available test suits use:

```console
yarn test
```

It's also possible to execute and debug a single test file in VSCode/Theia via the File explorer.
Simply select a test file (`*.spec.ts`), then go to the `Run & Debug` View (`Ctrl+Shift+D`), select the 'Run current test" launch config and start debugging (`Ctrl+F11`)

## Workflow Diagram Example

The workflow diagram is a consistent example provided by all GLSP components.
The example implements a simple flow chart diagram editor with different types of nodes and edges (see screenshot below).
The example can be used to try out different GLSP features, as well as several available integrations with IDE platforms (Theia, VSCode, Eclipse, Standalone).
As the example is fully open source, you can also use it as a blueprint for a custom implementation of a GLSP diagram editor.
See [our project website](https://www.eclipse.org/glsp/documentation/#workflowoverview) for an overview of the workflow example and all components implementing it.

https://user-images.githubusercontent.com/588090/154459938-849ca684-11b3-472c-8a59-98ea6cb0b4c1.mp4

### How to start the Workflow Diagram example?

To see the diagram in action, you need to choose and launch one diagram client, see [here for an overview of available clients](https://www.eclipse.org/glsp/examples/#workflowoverview).

-   [`glsp-theia-integration`](https://github.com/eclipse-glsp/glsp-theia-integration): Diagrams clients integrated into [Theia](https://github.com/theia-ide/theia).
-   [`glsp-vscode-integration`](https://github.com/eclipse-glsp/glsp-vscode-integration): Diagram clients integrated into [VSCode](https://github.com/microsoft/vscode).
-   [`glsp-eclipse-integration`](https://github.com/eclipse-glsp/glsp-eclipse-integration): Diagram clients integrated into Eclipse IDE.

Please look at the workflow example guides in the repository linked above to get more information on building and running the respective GLSP clients.

### Launch Workflow Example Server

#### Socket

To launch the server for TCP sockets use:

```console
yarn start
```

This starts a server that is listening on port 5007 for incoming client requests.

To debug you can use the `Debug workflow example GLSP Server` launch configuration.
To test the server you have to connect a workflow GLSP client that supports JSON-RPC via socket.
We recommend to use the client provided by the [`glsp-integration`](https://github.com/eclipse-glsp/glsp-theia-integration#how-to-start-the-workflow-diagram-example-server-from-the-sources).

#### Websocket

To launch the server for WebSockets use:

```console
yarn start:websocket
```

This starts a server that is listening on the `ws://localhost:8081/workflow` endpoint for incoming client requests.

To debug you can use the `Debug workflow example GLSP Server (Websocket)` launch configuration.
To test the server you have to connect a workflow GLSP client that supports JSON-RPC via WebSocket.
We recommend to use the standalone example provided by [`glsp-client`](https://github.com/eclipse-glsp/glsp-client/blob/master/README.md#how-to-start-the-workflow-diagram-example).

## More information

For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp) and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/).
If you have questions, please raise them in the [discussions](https://github.com/eclipse-glsp/glsp/discussions) and have a look at our [communication and support options](https://www.eclipse.org/glsp/contact/).
