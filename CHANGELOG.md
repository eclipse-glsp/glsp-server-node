# Eclipse GLSP Server Changelog

## v2.5.0 -active

### Changes

### Potentially breaking changes

## [v2.4.0 - 04/04/2025](https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v2.4.0)

### Changes

-   [layout] Fix a bug regarding the application of routing point information in `ComputedBoundsActionHandler` [#103](https://github.com/eclipse-glsp/glsp-server-node/pull/103)
-   [gmodel] Cancel pending progress reporters in `RequestModelActionHandler` if an error occurred [#104](https://github.com/eclipse-glsp/glsp-server-node/pull/104)
-   [operation] Improve `OperationActionHandler` to ensure that a new model is only submitted after actual changes [#105](https://github.com/eclipse-glsp/glsp-server-node/pull/105)
-   [server] Ensure correct log level logging for `ConsoleLogger` [#106](https://github.com/eclipse-glsp/glsp-server-node/pull/106)
-   [server] Avoid configuration of winston logger if logging is disabled via options [#107](https://github.com/eclipse-glsp/glsp-server-node/pull/107)

### Potentially breaking changes

## [v2.3.0 - 23/12/2024](https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v2.3.0)

### Changes

-   [api] Update align default type mappings with the client-side types [#97](https://github.com/eclipse-glsp/glsp-server-node/pull/97)
-   [workflow] Fix a but in the `WorkflowEdgeCreationChecker` that prevented creation of weighted edges [#98](https://github.com/eclipse-glsp/glsp-server-node/pull/98)
-   [model] Refactor `ModelSubmissionHandler` to use async live validation by default [#99](https://github.com/eclipse-glsp/glsp-server-node/pull/99/)

### Potentially breaking changes

## [v2.2.1 - 22/07/2024](https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v2.2.1)

### Changes

-   [layout] Ensure that model is updated correctly when using `automatic` server layout [#74](https://github.com/eclipse-glsp/glsp-server-node/pull/74)
-   [gmodel] Add proper undefined/null handling in GModel builder functions [#76](https://github.com/eclipse-glsp/glsp-server-node/pull/76)
-   [launch] Improve Winston-Logger implementation to properly handle non-serializable objects [#82](https://github.com/eclipse-glsp/glsp-server-node/pull/82)
-   [layout] Ensure that including `ElkLayoutEngine` engine does not error in browser-only server implementations [#83](https://github.com/eclipse-glsp/glsp-server-node/pull/83)
-   [gmodel] Introduce new `Resizable` interface that is implemented by all `GShapeElements` and allows per-element definition of resize handle locations [#84](https://github.com/eclipse-glsp/glsp-server-node/pull/84)
-   [action] Ensure that actions queued with `dispatchAfterNextUpdate` are also dispatched after the initial `SetModelAction` [#88](https://github.com/eclipse-glsp/glsp-server-node/pull/88)

### Potentially Breaking Changes

-   [protocol] Removed local definition of `GIssueMarker` and reuse it from `@eclipse-glsp/protocol` instead [#88](https://github.com/eclipse-glsp/glsp-server-node/pull/88)
    -   => `GIssueMarker` is now an interface instead of a class

## [v2.1.0 - 25/01/2024](https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v2.1.0)

-   [operation] Add support for defining ghost elements/templates in `CreateNodeOperationHandler`'s [#65](https://github.com/eclipse-glsp/glsp-server-node/pull/65)
-   [launch] Use "127.0.0.1" as default host to avoid potential IP v4/v6 connection issues [#67](https://github.com/eclipse-glsp/glsp-server-node/pull/67)
-   [gmodel] Fix a bug in `GModelDeleteOperationHandler` that prevented deletion of multiple selected elements [#68](https://github.com/eclipse-glsp/glsp-server-node/pull/68)

## [v2.0.0 - 14/10/2023](<(https://github.com/eclipse-glsp/glsp-server-node/releases/tag/v2.0.0)>)

### Changes

-   [elk] Fix a bug in the `GLSElkLayoutEngine` that skipped layouting of certain edges [#23](https://github.com/eclipse-glsp/glsp-server-node/pull/23) - Contributed on behalf of STMicroelectronics
-   [launch] The message sent after successful startup now also contains the effective socket port [#30](https://github.com/eclipse-glsp/glsp-server-node/pull/30) - Contributed on behalf of STMicroelectronics
-   [launch] Fix a bug that caused the server to not properly dispose all resources when `shutdown` was called [#33](https://github.com/eclipse-glsp/glsp-server-node/pull/33) - Contributed on behalf of STMicroelectronics
-   [diagram] Fix a bug to ensure that the copy&paste feature is working properly [#35](https://github.com/eclipse-glsp/glsp-server-node/pull/35)
-   [api] Ensure that all `Promise`s and `MaybePromise`s have proper rejection handling [#36](https://github.com/eclipse-glsp/glsp-server-node/pull/36)- Contributed on behalf of STMicroelectronics
-   [launch] Add a launcher component for starting WebSocket based GLSP servers [#41](https://github.com/eclipse-glsp/glsp-server-node/pull/41)
-   [validation] Add explicit support and API for live and batch validation [#43](https://github.com/eclipse-glsp/glsp-server-node/pull/43)
-   [launch] Launcher components now auto allocate a free port if the port argument is 0 [#42](https://github.com/eclipse-glsp/glsp-server-node/pull/42)
-   [server] Add support for server progress reporting [#52](https://github.com/eclipse-glsp/glsp-server-node/pull/52)
-   [diagram] Add support for handling reconnection requests to `RequestModelActionHandler` [#54](https://github.com/eclipse-glsp/glsp-server-node/pull/54/)
-   [server] Update `AbstractJsonModelStorage` to ensure that Windows file paths are properly converted [#55](https://github.com/eclipse-glsp/glsp-server-node/pull/55)
-   [deps] Remove unneeded dependency to `fs-extra` [#56](https://github.com/eclipse-glsp/glsp-server-node/pull/56)
-   [diagram] Provide generic reusable base operation handlers for JSON-based source models [#59](https://github.com/eclipse-glsp/glsp-server-node/pull/59)
-   [diagram] Add support for dynamic edge type hints
    -   Provide `EdgeCreationChecker` API. Adopters can implement this to handle dynamic edge creation validation requests. [#60](https://github.com/eclipse-glsp/glsp-server-node/pull/60)
-   [model] Introduce new `GForeignObjectElement` + builder class [#61](https://github.com/eclipse-glsp/glsp-server-node/pull/61)

### Breaking Changes

-   [graph] Align GGraph model with newest changes from glsp-server [#22](https://github.com/eclipse-glsp/glsp-server-node/pull/22) - Contributed on behalf of STMicroelectronics
    -   Renamed interfaces:
        -   `EdgePlacement` -> `GEdgePlacement` (affected classes: `GEdgeLayoutable`, `GLabel`)
        -   `GLayoutContainer` -> `GLayouting` (affected classes: `GCompartment`, `GGraph`, `GNode`)
        -   `GShapePreRenderedElement` -> `GShapedPreRenderedElement`
-   [deps] Update minimum requirements for Node to >=16.11.0 [#32](https://github.com/eclipse-glsp/glsp-client/pull/32)
-   [api] Restructure `@eclipse-glsp/server-node` package to provide entry points for both node and browser-only environments [#37](https://github.com/eclipse-glsp/glsp-server-node/pull/37)
    -   The package has been renamed to `@eclipse-glsp/server`. This change affects all import namespaces.
    -   New namespaces for environment specific code:
        -   `@eclipse-glsp/server/node`
        -   `@eclipse-glsp/server/browser`
-   [operation] Implement Command API and rework OperationHandler to provide an optional command instead of direct execution to allow more execution control (including undo & redo support) [#38](https://github.com/eclipse-glsp/glsp-server-node/pull/38) [#59](https://github.com/eclipse-glsp/glsp-server-node/pull/59)
    -   This includes major breaking changes across the whole API:
        -   `OperationHandler` has been refactored from an interface to a common abstract base class. The `execute` method now has to return a `MaybePromise<Command|undefined>`
        -   Refactor `CreateOperationHandler` to an interface instead of a class
        -   Rename the services and handlers of the direct GModel library => consistent use of `GModel` prefix
        -   The `ModelState` interface no longer has an `isDirty` flag. Dirty state is now handled by the `CommandStack`
-   [server] Default port has changed from 5007 (and 8081 for websocket) to 0, which implies autoassignment by the OS [#42](https://github.com/eclipse-glsp/glsp-server-node/pull/42)
-   [server] Refactored `GLSPServer` and `GLSPServerLauncher` API [#44](https://github.com/eclipse-glsp/glsp-server-node/pull/44) - Contributed on behalf of STMicroelectronics
    -   Server type definitions are now consumed from `@eclipse-glsp/protocol`
    -   `GLSPServer` implementation is no longer relies on json-rpc implementation details.
    -   JSON-RPC setup is now done with `JsonRpcGLSPServerLauncher`
-   [api] Provide `CommandStack` API to support undo/redo of model changes [#38](https://github.com/eclipse-glsp/glsp-server-node/pull/38) [#39](https://github.com/eclipse-glsp/glsp-server-node/pull/39) - Contributed on behalf of STMicroelectronics
    -   `ModelState` no longer has a `isDirty` property
    -   Breaking refactor of `OperationHandler` API
-   [deps] Update to inversify 6.x and Typescript 5.x. [#48](https://github.com/eclipse-glsp/glsp-server-node/pull/48)
    -   GLSP uses a synchronous inversify context this means with inversify 6.x decorator methods (e.g. `@postConstruct`) with asynchronous results are no longer supported
-   [api] Revise model loading and client action handling [#57](https://github.com/eclipse-glsp/glsp-server-node/pull/57) [#58](https://github.com/eclipse-glsp/glsp-server-node/pull/58)
    -   Refactor `ModelSubmissionHandler` to enable handling of `RequestModelAction` as proper request action
        -   Introduce a `submitInitialModel` method that is called by the `RequestModelActionHandler`
    -   Remove `configureClientActions` from `DiagramModule` as client actions are now implicitly configured via `InitializeClientSession` request
    -   Remove `ClientActionHandler` and replace with `ClientActionForwarder`
    -   Rename `ServerStatusAction` -> `StatusAction` and `ServerMessageAction` -> `MessageAction`

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
