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

import { Args, ClientSessionInitializer, Registry } from '@eclipse-glsp/server';
import { inject, injectable, optional } from 'inversify';
import { McpDiagramScopedInput } from './mcp-input-schemas';
import { AbstractMcpDiagramPromptHandler, McpDiagramPromptHandlerConstructor } from './mcp-prompt-handler';

/** See {@link McpDiagramToolHandlerFactory} — same lifecycle pattern, applied to prompt handlers. */
export type McpDiagramPromptHandlerFactory = (
    constructor: McpDiagramPromptHandlerConstructor
) => AbstractMcpDiagramPromptHandler<McpDiagramScopedInput>;
export const McpDiagramPromptHandlerFactory = Symbol('McpDiagramPromptHandlerFactory');

/** See {@link McpDiagramToolHandlerRegistry} — same lifecycle pattern, applied to prompt handlers. */
@injectable()
export class McpDiagramPromptHandlerRegistry extends Registry<string, AbstractMcpDiagramPromptHandler<McpDiagramScopedInput>> {
    registerHandler(handler: AbstractMcpDiagramPromptHandler<McpDiagramScopedInput>): boolean {
        return this.register(handler.name, handler);
    }
}

/** See {@link McpDiagramToolHandlerRegistryInitializer} — same lifecycle pattern, applied to prompt handlers. */
@injectable()
export class McpDiagramPromptHandlerRegistryInitializer implements ClientSessionInitializer {
    @inject(McpDiagramPromptHandlerFactory) protected factory: McpDiagramPromptHandlerFactory;

    @inject(McpDiagramPromptHandlerConstructor)
    @optional()
    protected constructors: McpDiagramPromptHandlerConstructor[] = [];

    @inject(McpDiagramPromptHandlerRegistry) protected registry: McpDiagramPromptHandlerRegistry;

    initialize(_args?: Args): void {
        for (const constructor of this.constructors) {
            try {
                this.registry.registerHandler(this.factory(constructor));
            } catch (err: unknown) {
                throw new Error(
                    `Failed to instantiate MCP diagram prompt handler '${constructor.name}': ${(err as Error).message}. ` +
                        'Check your DiagramModule bindings.'
                );
            }
        }
    }
}
