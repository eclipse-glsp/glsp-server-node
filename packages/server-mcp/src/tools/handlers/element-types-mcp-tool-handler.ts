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

import {
    ClientSessionInitializer,
    ClientSessionManager,
    DiagramModules,
    InjectionContainer,
    createClientSessionModule
} from '@eclipse-glsp/server';
import { Container, ContainerModule, inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { AbstractMcpToolHandler, McpToolError, McpToolResult } from '../../server';
import { ElementTypes, ElementTypesProvider } from '../../resources/services/element-types-provider';

export const ElementTypesInputSchema = z.object({
    sessionId: z.string().optional().describe('Open GLSP session id; diagram type is derived from it. Provide this OR `diagramType`.'),
    diagramType: z.string().optional().describe('Diagram type to query. Provide this OR `sessionId`; useful when no session is open yet.')
});
export type ElementTypesInput = z.infer<typeof ElementTypesInputSchema>;

/**
 * `id` + `label` are required (the default registry-scrape provides both); `description` and
 * `acceptsText` are optional adopter-richer fields. `.loose()` lets adopter providers attach
 * arbitrary extra fields without us having to widen the schema each time.
 */
export const ElementTypeEntrySchema = z
    .object({
        id: z.string().describe('Element type id used by `create-*` tools (e.g. `task:manual`).'),
        label: z.string().describe('Human-readable display name for the element TYPE (e.g. `Manual Task`).'),
        description: z.string().optional().describe('Adopter-supplied human-readable description.'),
        acceptsText: z
            .boolean()
            .optional()
            .describe('Whether `create-*` / `modify-*` tools should pass a `text` arg for elements of this type. Absent ⇒ unknown.')
    })
    .loose();

export const ElementTypesOutputSchema = z.object({
    diagramType: z.string(),
    nodeTypes: z.array(ElementTypeEntrySchema),
    edgeTypes: z.array(ElementTypeEntrySchema)
});

/**
 * Server-scope so the LLM can discover types before opening a session. Lazy-harvests the
 * per-diagram-type {@link ElementTypesProvider} via a temporary child container (same pattern
 * as core's `DefaultGlobalActionProvider`) and caches the result for the server's lifetime —
 * element-type sets are static at runtime, so we pay the harvest cost once per type.
 *
 * Adopters with statically-known type info bind their own {@link ElementTypesProvider} via
 * `bindElementTypesProvider()`; the harvest picks it up without further overrides.
 */
@injectable()
export class ElementTypesMcpToolHandler extends AbstractMcpToolHandler<ElementTypesInput> {
    @inject(DiagramModules) protected diagramModules: Map<string, ContainerModule[]>;
    @inject(InjectionContainer) protected serverContainer: Container;
    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    static readonly NAME = 'element-types';
    readonly name = ElementTypesMcpToolHandler.NAME;
    override readonly title = 'Creatable Element Types';
    readonly description =
        'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
        'Use this to discover valid `elementTypeId` values for the create-nodes / create-edges tools. ' +
        'Pass `sessionId` for the diagram you are working in (recommended), or `diagramType` directly ' +
        'when no session of that type is open yet (e.g. when creating a brand-new diagram).';
    readonly inputSchema = ElementTypesInputSchema;
    override readonly outputSchema = ElementTypesOutputSchema;

    protected readonly cache = new Map<string, ElementTypes>();

    protected createResult({ sessionId, diagramType }: ElementTypesInput): McpToolResult {
        const resolved = diagramType ?? this.resolveDiagramType(sessionId);
        const { nodeTypes, edgeTypes } = this.getElementTypes(resolved);
        return this.success(this.summarizeElementTypes(resolved, nodeTypes, edgeTypes), {
            diagramType: resolved,
            nodeTypes,
            edgeTypes
        });
    }

    /** Builds the LLM-facing summary. Override to customize per-adopter wording. */
    protected summarizeElementTypes(
        diagramType: string,
        nodeTypes: ElementTypes['nodeTypes'],
        edgeTypes: ElementTypes['edgeTypes']
    ): string {
        return (
            `Diagram type '${diagramType}': ${nodeTypes.length} node type(s), ${edgeTypes.length} edge type(s); ` +
            `full details in structuredContent.\n` +
            `- Node types: ${nodeTypes.map(entry => entry.id).join(', ') || '(none)'}\n` +
            `- Edge types: ${edgeTypes.map(entry => entry.id).join(', ') || '(none)'}`
        );
    }

    protected resolveDiagramType(sessionId: string | undefined): string {
        if (!sessionId) {
            throw new McpToolError('Either `diagramType` or `sessionId` must be provided.');
        }
        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            throw new McpToolError(`Unknown sessionId: ${sessionId}`);
        }
        return session.diagramType;
    }

    protected getElementTypes(diagramType: string): ElementTypes {
        let types = this.cache.get(diagramType);
        if (!types) {
            types = this.harvestElementTypes(diagramType);
            this.cache.set(diagramType, types);
        }
        return types;
    }

    /** Runs session-open initializers on a throwaway container so registries (e.g. `OperationHandlerRegistry`) are populated for the provider to scrape. */
    protected harvestElementTypes(diagramType: string): ElementTypes {
        const modules = this.diagramModules.get(diagramType);
        if (!modules) {
            throw new McpToolError(`Unknown diagram type: ${diagramType}`);
        }
        const tempContainer = this.serverContainer.createChild();
        try {
            const placeholderSessionModule = createClientSessionModule({
                clientId: 'mcp-element-types-temp',
                glspClient: { process: () => {} },
                clientActionKinds: []
            });
            tempContainer.load(...modules, placeholderSessionModule);
            const initializers = tempContainer.getAll<ClientSessionInitializer>(ClientSessionInitializer);
            initializers.forEach(initializer => initializer.initialize());
            return tempContainer.get<ElementTypesProvider>(ElementTypesProvider).get();
        } finally {
            tempContainer.unbindAll();
        }
    }
}
