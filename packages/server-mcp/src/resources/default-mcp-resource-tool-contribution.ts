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

import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { FEATURE_FLAGS } from '../feature-flags';
import { GLSPMcpServer, McpServerContribution } from '../server';
import { createResourceToolResult } from '../util';
import { McpResourceDocumentationHandler } from './handlers/documentation-handler';
import { McpResourcePngHandler } from './handlers/export-png-handler';
import { McpResourceModelHandler } from './handlers/model-handler';
import { McpResourceSessionHandler } from './handlers/session-handler';

/**
 * Default MCP server contribution that provides read-only resources for accessing
 * GLSP server state, including sessions, element types, and diagram models.
 *
 * However, as not all MCP clients are able to deal with resources, this class instead
 * provides them as tools. For the core implementation, see {@link DefaultMcpResourceContribution}.
 *
 * This contribution can be overridden to customize or extend resource functionality.
 */
@injectable()
export class DefaultMcpResourceToolContribution implements McpServerContribution {
    @inject(McpResourceDocumentationHandler)
    protected documentationHandler: McpResourceDocumentationHandler;
    @inject(McpResourceSessionHandler)
    protected sessionHandler: McpResourceSessionHandler;
    @inject(McpResourceModelHandler)
    protected modelHandler: McpResourceModelHandler;
    @inject(McpResourcePngHandler)
    protected pngHandler: McpResourcePngHandler;

    configure(server: GLSPMcpServer): void {
        this.registerSessionsListResource(server);
        this.registerElementTypesResource(server);
        this.registerDiagramModelResource(server);
        if (FEATURE_FLAGS.resources.png) {
            this.registerDiagramPngResource(server);
        }
    }

    protected registerSessionsListResource(server: GLSPMcpServer): void {
        server.registerTool(
            'sessions-list',
            {
                title: 'GLSP Sessions List',
                description: 'List all active GLSP client sessions across all diagram types'
            },
            () => createResourceToolResult(this.sessionHandler.getAllSessions())
        );
    }

    protected registerElementTypesResource(server: GLSPMcpServer): void {
        server.registerTool(
            'element-types',
            {
                title: 'Creatable Element Types',
                description:
                    'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
                    'Use this to discover valid elementTypeId values for creation tools.',
                inputSchema: {
                    diagramType: z.string().describe('Diagram type whose elements should be discovered')
                }
            },
            params => createResourceToolResult(this.documentationHandler.getElementTypes(params.diagramType))
        );
    }

    protected registerDiagramModelResource(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-model',
            {
                title: 'Diagram Model Structure',
                description:
                    'Get the complete GLSP model for a session as a markdown structure. ' +
                    'Includes all nodes, edges, and their relevant properties.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the node should be created')
                }
            },
            params => createResourceToolResult(this.modelHandler.getDiagramModel(params.sessionId))
        );
    }

    protected registerDiagramPngResource(server: GLSPMcpServer): void {
        server.registerTool(
            'diagram-png',
            {
                title: 'Diagram Model PNG',
                description:
                    'Get the complete image of the model for a session as a PNG. ' +
                    'Includes all nodes and edges to help with visually relevant tasks.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID for which the image should be created')
                }
            },
            async params => {
                const result = await this.pngHandler.getModelPng(params.sessionId);
                return {
                    isError: result.isError,
                    content: [
                        {
                            type: 'image',
                            data: (result.content as any).blob,
                            mimeType: 'image/png'
                        }
                    ]
                };
            }
        );
    }
}
