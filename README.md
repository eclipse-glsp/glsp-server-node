# Node GLSP Server

Node based server component for the Eclipse Graphical Language Platform (GLSP).
The implementation of this server is aligned with the default Java based [GLSP Server](https://github.com/eclipse-glsp/glsp-server).

The server consists of three components:

-   [`@eclipse-glsp/server-node`](packages/server-node/) The base framework for building node based GLSP servers
-   [`@eclipse-glsp/graph`](packages/graph/) The Typescript based implementation of the graphical model used in GLSP (GModel).
-   [`@eclipse-glsp-examples/workflow-server`](examples/workflow-server) GLSP example server using the workflow model.

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

To debug you can use the `Debug workflow example GLSP Server` launch configuration. Note that you need to use the start:debug scripts or ...(without GLSP server) launch configurations for the Theia applications for them to connect to this GLSP server.

## More information

For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp) and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/).
If you have questions, please raise them in the [discussions](https://github.com/eclipse-glsp/glsp/discussions) and have a look at our [communication and support options](https://www.eclipse.org/glsp/contact/).
