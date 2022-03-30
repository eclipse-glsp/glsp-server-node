# Eclipse GLSP Server Node Changelog

## v0.10.0- Upcoming

Inception of the Node GLSP Server.
This project provides the Node based server component for the Eclipse Graphical Language Platform (GLSP).
The implementation of this server is aligned with the default Java based [GLSP Server](https://github.com/eclipse-glsp/glsp-server).
The initial initial implementation was contributed on behalf of STMicroelectronics.

### Changes

-   [diagram] Implement LayoutEngine API for server-side autolayouting & provide an integration package for layout engines based on ELK. [#509](https://github.com/eclipse-glsp/glsp-server-node/pull/2) [#514](https://github.com/eclipse-glsp/glsp-server-node/pull/5) - Contributed on behalf of STMicroelectronics

### Breaking Changes

-   [server] Source model refactorings [#582](https://github.com/eclipse-glsp/glsp/issues/582)
    -   `ModelSourceLoader` → `SourceModelStorage`
    -   Added method to `SourceModelStorage`
