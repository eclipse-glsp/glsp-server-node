/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

// TODO development tool, replace with proper implementation as needed
/**
 * Provides a simple interface to enable/disable specific features during development
 */
export const FEATURE_FLAGS = {
    /**
     * Changes how resources are registered.
     * This is relevant since some MCP clients are unable to deal with MCP resource endpoints
     * and thus they must be provided as tools.
     *
     * true -> MCP resources
     *
     * false -> MCP tools
     */
    useResources: false,
    /** Changes whether structured data should be returned as JSON or Markdown. */
    useJson: false,
    /** Changes string-based IDs to integer strings for MCP communication */
    aliasIds: true,
    /** Enable or disable unstable resources */
    resources: {
        diagramPng: true
    },
    /** Enable or disable unstable tools */
    tools: {
        undo: true,
        redo: true,
        saveModel: true
    }
};
