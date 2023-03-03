# GLSP Server [![Build Status](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-server-node/job/main/badge/icon)](https://ci.eclipse.org/glsp/job/eclipse-glsp/job/glsp-server-node/job/main/)

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
