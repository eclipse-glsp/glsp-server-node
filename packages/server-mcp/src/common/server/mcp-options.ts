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

import { McpServerOptions as McpServerOptionsType } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';

/**
 * Holds the launcher-scoped MCP options. The launcher merges adopter-provided defaults
 * (passed to the {@link AbstractMcpServerModule} constructor, bound as
 * {@link McpServerDefaults}) with deployment-time overrides from the GLSP `initialize` request,
 * then writes the merged result to `values`. Consumers `@inject(McpServerOptions)` and read
 * `.values.<key>` directly.
 *
 * Bound as a singleton on the server container — the shared reference means server-scope
 * singletons constructed before init still observe populated values once init runs.
 *
 * @experimental
 */
@injectable()
export class McpServerOptions {
    values: McpServerOptionsType = {};
}

/**
 * DI binding identifier for adopter-provided default options. Supplied via the
 * {@link AbstractMcpServerModule} constructor and merged with init-time options by
 * `AbstractMcpServerLauncher.initializeServer` — init-time wins per field.
 */
export const McpServerDefaults = Symbol('McpServerDefaults');
export type McpServerDefaults = McpServerOptionsType;
