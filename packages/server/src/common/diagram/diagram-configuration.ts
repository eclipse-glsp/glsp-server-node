/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { GModelElementConstructor } from '@eclipse-glsp/graph';
import { EdgeTypeHint, ShapeTypeHint } from '@eclipse-glsp/protocol';

/**
 * Used to configure whether and when a diagram server should auto-layout the graphical model.
 *
 * The layout is computed with the layout engine configured, so a value other
 * than <code>NONE</code> here makes sense only if such an engine is available.
 */
export enum ServerLayoutKind {
    /**
     * The server re-layouts the diagram on all changes automatically. Layout
     * information stored in the model will be overwritten.
     */
    AUTOMATIC,

    /**
     * The server re-layouts the diagram only if manually triggered by a
     * <code>LayoutAction</code>. The layout information must be stored in the model
     * and will be overwritten on layout.
     */
    MANUAL,

    /**
     * The server never layouts the diagram. This requires that the layout
     * information is stored in the model.
     */
    NONE
}

export const DiagramConfiguration = Symbol('DiagramConfiguration');
/**
 * Provides configuration constants for a specific diagram implementation (i.e. diagram language),
 * The corresponding configuration for a diagram implementation is identified via its diagram type.
 */
export interface DiagramConfiguration {
    /**
     * Returns the shape type hints for the diagram implementation. Shape type hints are sent to the client and used to
     * validate whether certain operations for shapes/nodes are allowed without having to query the server again.
     *
     * @returns List of all shape type hints for the diagram implementation.
     */
    readonly shapeTypeHints: ShapeTypeHint[];

    /**
     * Returns the edge type hints for the diagram implementation. Edge type hints are sent to the client and used to
     * validate whether certain operations for edges are allowed without having to query the server again.
     *
     * @returns List of all edge type hints for the diagram implementation.
     */
    readonly edgeTypeHints: EdgeTypeHint[];

    /**
     * Returns the supported layout kind for this diagram implementation.
     *
     * @returns The layout kind.
     */
    readonly layoutKind: ServerLayoutKind;

    /**
     * Boolean flag to specific whether the diagram implementation expects the client to provide layout information for
     * certain diagram element. Default is 'true'.
     *
     * @returns Boolean flag to indicate whether the client needs to be involved in the layout process.
     */
    readonly needsClientLayout: boolean;

    /**
     * Boolean flag to tell the client whether changed caused by an update should be animated or not.
     *
     * @returns Boolean flag to indicate whether the client should animate update changes.
     */
    readonly animatedUpdate: boolean;

    /**
     * Returns the type mappings for the diagram implementation. Type mappings are used by GSON to construct the correct
     * {@link EClass} based on the "type" property of the JSON object.
     *
     * @returns A complete map of all type mappings for the diagram implementation.
     */
    readonly typeMapping: Map<string, GModelElementConstructor>;
}
