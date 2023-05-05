# Eclipse GLSP Server Node Changelog

## v1.1.0 - upcoming

-   [elk] Fixed a bug in the `GLSElkLayoutEngine` that skipped layouting of certain edges [#23](https://github.com/eclipse-glsp/glsp-server-node/pull/23) - Contributed on behalf of STMicroelectronics
-   [launch] The message sent after successful startup now also contains the effective socket port [#30](https://github.com/eclipse-glsp/glsp-server-node/pull/30) - Contributed on behalf of STMicroelectronics
-   [launch] Fixed a bug that caused the server to no properly dispose all resources when `shutdown` was called [#33](https://github.com/eclipse-glsp/glsp-server-node/pull/33) - Contributed on behalf of STMicroelectronics
-   [diagram] Fixed a bug to ensure that the copy&paste feature is working properly [#35](https://github.com/eclipse-glsp/glsp-server-node/pull/35)
-   [api] Ensured that all `Promise`s and `MaybePromises` have proper rejection handling [#36](https://github.com/eclipse-glsp/glsp-server-node/pull/36)- Contributed on behalf of STMicroelectronics
-   [launch] Add a launcher component for starting WebSocket based GLSP servers [#41](https://github.com/eclipse-glsp/glsp-server-node/pull/41)
-   [validation] Add explicit support and API for live and batch validation [#43](https://github.com/eclipse-glsp/glsp-server-node/pull/43)
-   [launch] Launcher components now auto allocate a free port if the port argument is 0 [#42](https://github.com/eclipse-glsp/glsp-server-node/pull/42)

### Breaking Changes

-   [graph] Align GGraph model with newest changes from glsp-server [#22](https://github.com/eclipse-glsp/glsp-server-node/pull/22) - Contributed on behalf of STMicroelectronics
    -   Renamed interfaces:
        -   `EdgePlacement` -> `GEdgePlacement` (affected classes: `GEdgeLayoutable`, `GLabel`)
        -   `GLayoutContainer` -> `GLayouting` (affected classes: `GCompartment`, `GGraph`, `GNode`)
        -   `GShapePreRenderedElement` -> `GShapedPreRenderedElement`
-   [deps] Update minimum requirements for Node to >=16.11.0 [#32](https://github.com/eclipse-glsp/glsp-client/pull/32)
-   [api] Restructured `@eclipse-glsp/server-node` package to provide entry points for both node and browser-only environments [#37](https://github.com/eclipse-glsp/glsp-server-node/pull/37)
    -   The package has been renamed to `@eclipse-glsp/server`. This change affects all import namespaces.
    -   New namespaces for environment specific code:
        -   `@eclipse-glsp/server/node`
        -   `@eclipse-glsp/server/browser`
-   [operation] Implement Command API and rework OperationHandler to provide an optional command instead of direct execution to allow more execution control (including undo & redo support) [#38](https://github.com/eclipse-glsp/glsp-server-node/pull/38)
    -   This includes major breaking changes across the whole API:
        -   `OperationHandler` has been refactored from an interface to a common abstract base class. The `execute` method now has to return a `MaybePromise<Command|undefined>`
        -   Refactored `CreateOperationHandler` to an interface instead of a class
        -   Renamed the services and handlers of the direct GModel library => consistent use of `GModel` prefix
        -   The `ModelState` interface no longer has an `isDirty` flag. Dirty state is now handled by the `CommandStack`
-   [server] Default port has changed from 5007 (and 8081 for websocket) to 0, which implies autoassignment by the OS [#42](https://github.com/eclipse-glsp/glsp-server-node/pull/42)
-   [server] Refactored `GLSPServer` and `GLSPServerLauncher` API [#44](https://github.com/eclipse-glsp/glsp-server-node/pull/44) - Contributed on behalf of STMicroelectronics
    -   Server type definitions are now consumed from `@eclipse-glsp/protocol`
    -   `GLSPServer` implementation is no longer relies on json-rpc implementation details.
    -   JSON-RPC setup is now done with `JsonRpcGLSPServerLauncher`
-   Provide `CommandStack` API to support undo/redo of model changes [#38](https://github.com/eclipse-glsp/glsp-server-node/pull/38) [#39](https://github.com/eclipse-glsp/glsp-server-node/pull/39) - Contributed on behalf of STMicroelectronics
    -   `ModelState` no longer has a `isDirty` property
    -   Breaking refactor of `OperationHandler` API

## [v1.0.0 - 30/06/2022](https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v1.0.0)

Inception of the Node GLSP Server.
This project provides the Node based server component for the Eclipse Graphical Language Platform (GLSP).
The implementation of this server is aligned with the default Java based [GLSP Server](https://github.com/eclipse-glsp/glsp-server).
The [initial implementation](https://github.com/eclipse-glsp/glsp-server-node/commit/4fba8e8beef07798a7eff27c9c04ca68583e5960) was contributed on behalf of STMicroelectronics.
The following list composes changes that have been made since the initial implementation.

### Changes (since the initial contribution )

-   [core] Implement `dispatchOnNextUpdate` method that enables queuing of actions that should be dispatched after the next graphical model update. [#1](https://github.com/eclipse-glsp/glsp-server-node/pull/1) - Contributed on behalf of STMicroelectronics
-   [diagram] Implement LayoutEngine API for server-side autolayouting & provide an integration package for layout engines based on ELK. [#2](https://github.com/eclipse-glsp/glsp-server-node/pull/2) [#5](https://github.com/eclipse-glsp/glsp-server-node/pull/5) - Contributed on behalf of STMicroelectronics

### Breaking Changes

-   [model] Source model refactorings [#11](https://github.com/eclipse-glsp/glsp-server-node/pull/11)
    -   `ModelSourceLoader` → `SourceModelStorage`
    -   Added method to `SourceModelStorage`
-   [model] Refactor `ModelState` API [#20](https://github.com/eclipse-glsp/glsp-server-node/pull/20)
    -   Introduce `updateRoot` method
    -   `DefaultModelState` => make root setter protected
-   [gmodel] Refactor & Move all base & helper classes for the direct GModel usecase into own `gmodel-lib` subdirectory [#16](https://github.com/eclipse-glsp/glsp-server-node/pull/16)
