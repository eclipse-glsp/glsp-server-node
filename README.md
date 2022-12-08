# Node GLSP Server

Node based server component for the Eclipse Graphical Language Platform (GLSP).
The implementation of this server is aligned with the default Java based [GLSP Server](https://github.com/eclipse-glsp/glsp-server).

The server consists of three components:

-   [`@eclipse-glsp/server-node`](packages/server-node/) The base framework for building node based GLSP servers
-   [`@eclipse-glsp/graph`](packages/graph/) The Typescript based implementation of the graphical model used in GLSP (GModel).
-   [`@eclipse-glsp-examples/workflow-server`](examples/workflow-server) GLSP example server using the workflow model.

## Integration & Features

Currently the node-based API does not yet support the full feature set of the Java GLSP Server API.
Below is a list of features that are currently supported.

| Integration                                       | Node Server | Java Server |
| ------------------------------------------------- | :---------: | :---------: |
| JSON-RPC over Socket (Theia, VSCode)              |      ✓      |      ✓      |
| JSON-RPC over Websocket (Standalone, Eclipse IDE) |             |      ✓      |

| Feature                                                           |   Node Server   |   Java Server   |
| ----------------------------------------------------------------- | :-------------: | :-------------: |
| Model Saving                                                      |        ✓        |        ✓        |
| Model Dirty State                                                 |        ✓        |        ✓        |
| Model SVG Export                                                  |        ✓        |        ✓        |
| Model Layout                                                      |        ✓        |        ✓        |
| Model Edit Modes<br>- Edit<br>- Read-only                         | <br>✓<br>&nbsp; |   <br>✓<br>✓    |
| Client View Port<br>- Center<br>- Fit to Screen                   |   <br>✓<br>✓    |   <br>✓<br>✓    |
| Client Status Notification                                        |        ✓        |        ✓        |
| Client Message Notification                                       |        ✓        |        ✓        |
| Element Selection                                                 |        ✓        |        ✓        |
| Element Hover                                                     |        ✓        |        ✓        |
| Element Validation                                                |        ✓        |        ✓        |
| Element Navigation                                                |                 |        ✓        |
| Element Type Hints                                                |        ✓        |        ✓        |
| Element Creation and Deletion                                     |        ✓        |        ✓        |
| Node Change Bounds<br>- Move<br>- Resize                          |   <br>✓<br>✓    |   <br>✓<br>✓    |
| Node Change Container                                             |        ✓        |        ✓        |
| Edge Reconnect                                                    |        ✓        |        ✓        |
| Edge Routing Points                                               |        ✓        |        ✓        |
| Element Text Editing                                              |        ✓        |        ✓        |
| Clipboard (Cut, Copy, Paste)                                      |                 |        ✓        |
| Undo / Redo                                                       |        ✓        |        ✓        |
| Contexts<br>- Context Menu<br>- Command Palette<br>- Tool Palette | <br><br>✓<br>✓  | <br>✓<br>✓<br>✓ |

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

## Start & Debug

The example server can be launched with:

```console
yarn start
```

To debug you can use the `Debug workflow example GLSP Server` launch configuration.
This starts the example server in a dedicated process. To test the server you have to connect a workflow GLSP client that supports JSON-RPC via socket.
We recommend to use the client provided by the [`glsp-integration`](https://github.com/eclipse-glsp/glsp-theia-integration#how-to-start-the-workflow-diagram-example-server-from-the-sources).

## More information

For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp) and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/).
If you have questions, please raise them in the [discussions](https://github.com/eclipse-glsp/glsp/discussions) and have a look at our [communication and support options](https://www.eclipse.org/glsp/contact/).
