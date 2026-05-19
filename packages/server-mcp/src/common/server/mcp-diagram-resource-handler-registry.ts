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
import { AbstractMcpDiagramResourceHandler, McpDiagramResourceHandlerConstructor } from './mcp-resource-handler';

/** See {@link McpDiagramToolHandlerFactory} — same lifecycle pattern, applied to resource handlers. */
export type McpDiagramResourceHandlerFactory = (
    constructor: McpDiagramResourceHandlerConstructor
) => AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>;
export const McpDiagramResourceHandlerFactory = Symbol('McpDiagramResourceHandlerFactory');

/** See {@link McpDiagramToolHandlerRegistry} — same lifecycle pattern, applied to resource handlers. */
@injectable()
export class McpDiagramResourceHandlerRegistry extends Registry<string, AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>> {
    registerHandler(handler: AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>): boolean {
        return this.register(handler.name, handler);
    }
}

/** See {@link McpDiagramToolHandlerRegistryInitializer} — same lifecycle pattern, applied to resource handlers. */
@injectable()
export class McpDiagramResourceHandlerRegistryInitializer implements ClientSessionInitializer {
    @inject(McpDiagramResourceHandlerFactory) protected factory: McpDiagramResourceHandlerFactory;

    @inject(McpDiagramResourceHandlerConstructor)
    @optional()
    protected constructors: McpDiagramResourceHandlerConstructor[] = [];

    @inject(McpDiagramResourceHandlerRegistry) protected registry: McpDiagramResourceHandlerRegistry;

    @inject(ClientId) protected clientId: string;

    @inject(Logger) protected logger: Logger;

    initialize(_args?: Args): void {
        // See {@link McpDiagramToolHandlerRegistryInitializer.initialize} for the probe rationale.
        const isProbe = this.clientId === TEMPORARY_CLIENT_ID;
        for (const constructor of this.constructors) {
            let handler: AbstractMcpDiagramResourceHandler<McpDiagramScopedInput>;
            try {
                handler = this.factory(constructor);
            } catch (err: unknown) {
                throw new Error(
                    `Failed to instantiate MCP diagram resource handler '${constructor.name}': ${(err as Error).message}. ` +
                        'Check your DiagramModule bindings.'
                );
            }
            if (!handler.canRegister()) {
                if (!isProbe) {
                    // Debug-level: returning false is the designed-for outcome when the connecting
                    // client doesn't speak the action the handler relies on (e.g. RequestExportAction
                    // for diagram-png / diagram-svg). Not actionable for operators.
                    this.logger.debug(`Skipping MCP diagram resource handler '${handler.name}': canRegister() returned false.`);
                }
                continue;
            }
            this.registry.registerHandler(handler);
        }
    }
}
