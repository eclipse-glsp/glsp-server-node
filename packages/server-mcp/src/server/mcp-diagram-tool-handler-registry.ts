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

import { Args, ClientId, ClientSessionInitializer, Logger, Registry, TEMPORARY_CLIENT_ID } from '@eclipse-glsp/server';
import { inject, injectable, optional } from 'inversify';
import { McpDiagramScopedInput } from './mcp-input-schemas';
import { BaseMcpDiagramToolHandler, McpDiagramToolHandlerConstructor } from './mcp-tool-handler';

/**
 * Per-GLSP-session factory that resolves a {@link McpDiagramToolHandlerConstructor} against the
 * per-session Inversify container. Calls `container.resolve(ctor)` so `@inject(...)` fields on
 * the handler are filled from the live `ClientSession.container` (alias service, model state,
 * action dispatcher, etc.).
 *
 * Mirrors core's {@link OperationHandlerFactory} pattern in `DiagramModule`.
 */
export type McpDiagramToolHandlerFactory = (
    constructor: McpDiagramToolHandlerConstructor
) => BaseMcpDiagramToolHandler<McpDiagramScopedInput>;
export const McpDiagramToolHandlerFactory = Symbol('McpDiagramToolHandlerFactory');

/**
 * Per-GLSP-session registry holding one {@link BaseMcpDiagramToolHandler} instance per
 * `metadata.name`. Populated at GLSP-session-open by {@link McpDiagramToolHandlerRegistryInitializer},
 * read at MCP-tool-call time by the launcher's dispatcher (looks up the right session, gets its
 * registry, resolves the handler by name, invokes `createResult`).
 *
 * Bound singleton-per-session on the diagram container.
 */
@injectable()
export class McpDiagramToolHandlerRegistry extends Registry<string, BaseMcpDiagramToolHandler<McpDiagramScopedInput>> {
    /** Convenience that derives the key from `handler.name` so callers don't repeat themselves. */
    registerHandler(handler: BaseMcpDiagramToolHandler<McpDiagramScopedInput>): boolean {
        return this.register(handler.name, handler);
    }
}

/**
 * {@link ClientSessionInitializer} that runs at GLSP-session-open. Reads the per-session
 * constructor multi-binding ({@link McpDiagramToolHandlerConstructor}) and instantiates each
 * handler via the {@link McpDiagramToolHandlerFactory}, registering the instance with the
 * per-session {@link McpDiagramToolHandlerRegistry}.
 *
 * Same shape as core's `OperationHandlerRegistryInitializer`.
 */
@injectable()
export class McpDiagramToolHandlerRegistryInitializer implements ClientSessionInitializer {
    @inject(McpDiagramToolHandlerFactory) protected factory: McpDiagramToolHandlerFactory;

    @inject(McpDiagramToolHandlerConstructor)
    @optional()
    protected constructors: McpDiagramToolHandlerConstructor[] = [];

    @inject(McpDiagramToolHandlerRegistry) protected registry: McpDiagramToolHandlerRegistry;

    @inject(ClientId) protected clientId: string;

    @inject(Logger) protected logger: Logger;

    initialize(_args?: Args): void {
        // Suppress the canRegister-false warn during core's `DefaultGlobalActionProvider`
        // startup probe — that probe runs on a throwaway container with empty action-kind set,
        // so `canRegister()` returning false there is structural, not a real opt-out.
        const isProbe = this.clientId === TEMPORARY_CLIENT_ID;
        for (const constructor of this.constructors) {
            let handler: BaseMcpDiagramToolHandler<McpDiagramScopedInput>;
            try {
                handler = this.factory(constructor);
            } catch (err: unknown) {
                throw new Error(
                    `Failed to instantiate MCP diagram tool handler '${constructor.name}': ${(err as Error).message}. ` +
                        'Check your DiagramModule bindings.'
                );
            }
            if (!handler.canRegister()) {
                if (!isProbe) {
                    this.logger.warn(`Skipping MCP diagram tool handler '${handler.name}': canRegister() returned false.`);
                }
                continue;
            }
            this.registry.registerHandler(handler);
        }
    }
}
