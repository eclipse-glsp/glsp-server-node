# Eclipse GLSP - GModel Demo Server

Provides the server-side configuration for the `gmodel-demo` example language as a reusable library package.

## GModel Demo Language

`gmodel-demo` is a minimal example language whose `.gm` files are a serialized form of the direct GModel using only default primitives (`GNode`, `GEdge`, `GLabel`, `GPort`, `GCompartment`, ...). It exists as a small, per-feature test bed for rendering and interaction conformance, complementing the realistic workflow editor.

This package only contributes a `DiagramModule` and `DiagramConfiguration` (the default type mapping, no type hints, no custom operation handlers — load-and-interact only). It ships no launcher: a host server composes it via `ServerModule.configureDiagramModule`, so a single server can host both the workflow and the gmodel-demo language. Persistence reuses the extension-agnostic `GModelStorage`/`GModelSerializer`.

## More information

For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp) and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/).
If you have questions, please raise them in the [discussions](https://github.com/eclipse-glsp/glsp/discussions) and have a look at our [communication and support options](https://www.eclipse.org/glsp/contact/).
