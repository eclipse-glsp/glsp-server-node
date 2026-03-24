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

import { ClientSessionManager, CreateOperationHandler, DiagramModules, Logger, OperationHandlerRegistry } from '@eclipse-glsp/server';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ContainerModule, inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpResourceHandler, ResourceHandlerResult } from '../../server';
import { createResourceResult, createResourceToolResult, extractResourceParam, objectArrayToMarkdownTable } from '../../util';
import { FEATURE_FLAGS } from '../../feature-flags';

/**
 * Lists the available element types for a given diagram type. This should likely include not only their id but also some description.
 * Additionally, some element types may not be creatable and should be omitted or annotated as such.
 */
@injectable()
export class ElementTypesMcpResourceHandler implements McpResourceHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(DiagramModules)
    protected diagramModules: Map<string, ContainerModule[]>;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerResource(server: GLSPMcpServer): void {
        server.registerResource(
            'element-types',
            new ResourceTemplate('glsp://types/{diagramType}/elements', {
                list: () => {
                    const diagramTypes = this.getDiagramTypes();
                    return {
                        resources: diagramTypes.map(type => ({
                            uri: `glsp://types/${type}/elements`,
                            name: `Element Types: ${type}`,
                            description: `Creatable element types for ${type} diagrams`,
                            mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown'
                        }))
                    };
                },
                complete: {
                    diagramType: () => this.getDiagramTypes()
                }
            }),
            {
                title: 'Creatable Element Types',
                description:
                    'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
                    'Use this to discover valid elementTypeId values for creation tools.',
                mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown'
            },
            async (_uri, params) => createResourceResult(await this.handle({ diagramType: extractResourceParam(params, 'diagramType') }))
        );
    }

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'element-types',
            {
                title: 'Creatable Element Types',
                description:
                    'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
                    'Use this to discover valid elementTypeId values for creation tools.',
                inputSchema: {
                    diagramType: z.string().describe('Diagram type whose elements should be discovered')
                },
                outputSchema: FEATURE_FLAGS.useJson
                    ? z.object({
                          diagramType: z.string(),
                          nodeTypes: z.array(
                              z.object({
                                  id: z.string(),
                                  label: z.string()
                              })
                          ),
                          edgeTypes: z.array(
                              z.object({
                                  id: z.string(),
                                  label: z.string()
                              })
                          )
                      })
                    : undefined
            },
            async params => createResourceToolResult(await this.handle(params))
        );
    }

    async handle({ diagramType }: { diagramType?: string }): Promise<ResourceHandlerResult> {
        this.logger.info(`'element-types' invoked for diagram type '${diagramType}'`);

        if (!diagramType) {
            return {
                content: {
                    uri: `glsp://types/${diagramType}/elements`,
                    mimeType: 'text/plain',
                    text: 'No diagram type provided.'
                },
                isError: true
            };
        }

        // Try to get a session of this diagram type to access the operation handler registry
        const sessions = this.clientSessionManager.getSessionsByType(diagramType);
        if (sessions.length === 0) {
            return {
                content: {
                    uri: `glsp://types/${diagramType}/elements`,
                    mimeType: 'text/plain',
                    text: 'No active session found for this diagram type. Create a session first to discover element types.'
                },
                isError: true
            };
        }

        const session = sessions[0];
        const registry = session.container.get<OperationHandlerRegistry>(OperationHandlerRegistry);

        const nodeTypes: Array<{ id: string; label: string }> = [];
        const edgeTypes: Array<{ id: string; label: string }> = [];

        // Extract the node and edge operations by the systematic the registry stores them
        for (const key of registry.keys()) {
            const handler = registry.get(key);
            if (handler && CreateOperationHandler.is(handler)) {
                if (key.startsWith('createNode_')) {
                    const elementTypeId = key.substring('createNode_'.length);
                    nodeTypes.push({ id: elementTypeId, label: handler.label });
                } else if (key.startsWith('createEdge_')) {
                    const elementTypeId = key.substring('createEdge_'.length);
                    edgeTypes.push({ id: elementTypeId, label: handler.label });
                }
            }
        }

        const elementTypesObj = { diagramType, nodeTypes, edgeTypes };
        const result = FEATURE_FLAGS.useJson
            ? JSON.stringify(elementTypesObj)
            : [
                  `# Creatable element types for diagram type "${diagramType}"`,
                  '## Node Types',
                  objectArrayToMarkdownTable(nodeTypes),
                  '## Edge Types',
                  objectArrayToMarkdownTable(edgeTypes)
              ].join('\n');

        return {
            content: {
                uri: `glsp://types/${diagramType}/elements`,
                mimeType: FEATURE_FLAGS.useJson ? 'application/json' : 'text/markdown',
                text: result
            },
            isError: false,
            data: elementTypesObj
        };
    }

    protected getDiagramTypes(): string[] {
        return Array.from(this.diagramModules.keys());
    }
}
