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

export * from './glsp-mcp-server';
export * from './mcp-diagram-handler-dispatcher';
export * from './mcp-diagram-prompt-handler-registry';
export * from './mcp-diagram-resource-handler-registry';
export * from './mcp-diagram-tool-handler-registry';
export * from './mcp-handler-shared';
export * from './mcp-http-transport';
export * from './mcp-id-alias-service';
export * from './mcp-input-schemas';
export * from './mcp-label-provider';
export * from './mcp-log-level-registry';
export * from './mcp-logger';
export * from './mcp-mime-types';
export * from './mcp-options';
export * from './mcp-progress-reporter';
export * from './mcp-prompt-handler';
export * from './mcp-request-context';
export * from './mcp-resource-handler';
export * from './mcp-server-launcher';
export * from './mcp-session';
export * from './mcp-tool-handler';

// `mcp-diagram-module` and `mcp-server-module` are intentionally not re-exported here —
// they import handler classes from `../resources` / `../tools`, which would create a circular
// import chain through this barrel. They are re-exported from the package root (`src/index.ts`)
// after the handler barrels finish initializing.
