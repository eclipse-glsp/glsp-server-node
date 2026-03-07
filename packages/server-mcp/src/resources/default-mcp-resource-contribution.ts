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

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';
import { inject, injectable } from 'inversify';
import { FEATURE_FLAGS } from '../feature-flags';
import { GLSPMcpServer, McpServerContribution } from '../server';
import { createResourceResult, extractResourceParam } from '../util';
import { McpResourceDocumentationHandler } from './handlers/documentation-handler';
import { McpResourcePngHandler } from './handlers/export-png-handler';
import { McpResourceModelHandler } from './handlers/model-handler';
import { McpResourceSessionHandler } from './handlers/session-handler';

/**
 * Default MCP server contribution that provides read-only resources for accessing
 * GLSP server state, including sessions, element types, and diagram models.
 *
 * This contribution can be overridden to customize or extend resource functionality.
 */
@injectable()
export class DefaultMcpResourceContribution implements McpServerContribution {
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
        server.registerResource(
            'sessions-list',
            'glsp://sessions',
            {
                title: 'GLSP Sessions List',
                description: 'List all active GLSP client sessions across all diagram types',
                mimeType: 'text/markdown'
            },
            () => createResourceResult(this.sessionHandler.getAllSessions())
        );
    }

    protected registerElementTypesResource(server: GLSPMcpServer): void {
        server.registerResource(
            'element-types',
            new ResourceTemplate('glsp://types/{diagramType}/elements', {
                list: () => {
                    const diagramTypes = this.documentationHandler.getDiagramTypes();
                    return {
                        resources: diagramTypes.map(type => ({
                            uri: `glsp://types/${type}/elements`,
                            name: `Element Types: ${type}`,
                            description: `Creatable element types for ${type} diagrams`,
                            mimeType: 'text/markdown'
                        }))
                    };
                },
                complete: {
                    diagramType: () => this.documentationHandler.getDiagramTypes()
                }
            }),
            {
                title: 'Creatable Element Types',
                description:
                    'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
                    'Use this to discover valid elementTypeId values for creation tools.',
                mimeType: 'text/markdown'
            },
            (_uri, params) => createResourceResult(this.documentationHandler.getElementTypes(extractResourceParam(params, 'diagramType')))
        );
    }

    protected registerDiagramModelResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-model',
            new ResourceTemplate('glsp://diagrams/{sessionId}/model', {
                list: () => {
                    const sessionIds = this.sessionHandler.getSessionIds();
                    return {
                        resources: sessionIds.map(sessionId => ({
                            uri: `glsp://diagrams/${sessionId}/model`,
                            name: `Diagram Model: ${sessionId}`,
                            description: `Complete GLSP model structure for session ${sessionId}`,
                            mimeType: 'text/markdown'
                        }))
                    };
                },
                complete: {
                    sessionId: () => this.sessionHandler.getSessionIds()
                }
            }),
            {
                title: 'Diagram Model Structure',
                description:
                    'Get the complete GLSP model for a session as a markdown structure. ' +
                    'Includes all nodes, edges, and their relevant properties.',
                mimeType: 'text/markdown'
            },
            (_uri, params) => createResourceResult(this.modelHandler.getDiagramModel(extractResourceParam(params, 'sessionId')))
        );
    }

    protected registerDiagramPngResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-png',
            new ResourceTemplate('glsp://diagrams/{sessionId}/png', {
                list: () => {
                    const sessionIds = this.sessionHandler.getSessionIds();
                    return {
                        resources: sessionIds.map(sessionId => ({
                            uri: `glsp://diagrams/${sessionId}/png`,
                            name: `Diagram PNG: ${sessionId}`,
                            description: `Complete PNG of the model for session ${sessionId}`,
                            mimeType: 'image/png'
                        }))
                    };
                },
                complete: {
                    sessionId: () => this.sessionHandler.getSessionIds()
                }
            }),
            {
                title: 'Diagram Model PNG',
                description:
                    'Get the complete image of the model for a session as a PNG. ' +
                    'Includes all nodes and edges to help with visually relevant tasks.',
                mimeType: 'image/png'
            },
            async (_uri, params) => {
                const result = await this.pngHandler.getModelPng(extractResourceParam(params, 'sessionId'));
                return createResourceResult(result);
            }
        );
    }
}
