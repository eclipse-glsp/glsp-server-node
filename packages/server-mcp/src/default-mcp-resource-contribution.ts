/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
    ClientSessionManager,
    CreateOperationHandler,
    DiagramModules,
    GModelSerializer,
    Logger,
    ModelState,
    OperationHandlerRegistry
} from '@eclipse-glsp/server';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp';
import { ReadResourceResult } from '@modelcontextprotocol/sdk/types';
import { ContainerModule, inject, injectable } from 'inversify';
import { McpServerContribution } from './mcp-server-contribution';
import { GLSPMcpServer } from './mcp-server-manager';
import { extractParam } from './mcp-util';

/**
 * Default MCP server contribution that provides read-only resources for accessing
 * GLSP server state, including sessions, diagram types, element types,
 * diagram models, and validation markers.
 *
 * This contribution can be overridden to customize or extend resource functionality.
 */
@injectable()
export class DefaultMcpResourceContribution implements McpServerContribution {
    @inject(Logger) protected logger: Logger;
    @inject(DiagramModules) protected diagramModules: Map<string, ContainerModule[]>;
    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    configure(server: GLSPMcpServer): void {
        this.registerSessionsListResource(server);
        this.registerSessionInfoResource(server);
        this.registerDiagramTypesResource(server);
        this.registerElementTypesResource(server);
        this.registerDiagramModelResource(server);
    }

    protected registerSessionsListResource(server: GLSPMcpServer): void {
        server.registerResource(
            'sessions-list',
            'glsp://sessions',
            {
                title: 'GLSP Sessions List',
                description: 'List all active GLSP client sessions across all diagram types',
                mimeType: 'application/json'
            },
            async () => this.getAllSessions()
        );
    }

    protected registerSessionInfoResource(server: GLSPMcpServer): void {
        server.registerResource(
            'session-info',
            new ResourceTemplate('glsp://sessions/{sessionId}', {
                list: async () => {
                    const sessions = this.clientSessionManager.getSessions();
                    return {
                        resources: sessions.map(session => ({
                            uri: `glsp://sessions/${session.id}`,
                            name: `Session: ${session.id}`,
                            description: `GLSP session for diagram type: ${session.diagramType}`,
                            mimeType: 'application/json'
                        }))
                    };
                },
                complete: {
                    sessionId: async () => this.getSessionIds()
                }
            }),
            {
                title: 'Session Information',
                description:
                    'Get detailed metadata for a specific GLSP client session including diagram type, source URI, and edit permissions',
                mimeType: 'application/json'
            },
            async (_uri, params) => this.getSessionInfo(params)
        );
    }

    protected registerDiagramTypesResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-types',
            'glsp://types',
            {
                title: 'Available Diagram Types',
                description: 'List all registered GLSP diagram types (e.g., workflow, class-diagram, state-machine)',
                mimeType: 'application/json'
            },
            async () => this.getDiagramTypesList()
        );
    }

    protected registerElementTypesResource(server: GLSPMcpServer): void {
        server.registerResource(
            'element-types',
            new ResourceTemplate('glsp://types/{diagramType}/elements', {
                list: async () => {
                    const diagramTypes = Array.from(this.diagramModules.keys());
                    return {
                        resources: diagramTypes.map(type => ({
                            uri: `glsp://types/${type}/elements`,
                            name: `Element Types: ${type}`,
                            description: `Creatable element types for ${type} diagrams`,
                            mimeType: 'application/json'
                        }))
                    };
                },
                complete: {
                    diagramType: async () => this.getDiagramTypes()
                }
            }),
            {
                title: 'Creatable Element Types',
                description:
                    'List all element types (nodes and edges) that can be created for a specific diagram type. ' +
                    'Use this to discover valid elementTypeId values for creation tools.',
                mimeType: 'application/json'
            },
            async (_uri, params) => this.getElementTypes(params)
        );
    }

    protected registerDiagramModelResource(server: GLSPMcpServer): void {
        server.registerResource(
            'diagram-model',
            new ResourceTemplate('glsp://diagrams/{sessionId}/model', {
                list: async () => {
                    const sessions = this.clientSessionManager.getSessions();
                    return {
                        resources: sessions.map(session => ({
                            uri: `glsp://diagrams/${session.id}/model`,
                            name: `Diagram Model: ${session.id}`,
                            description: `Complete GLSP model structure for session ${session.id}`,
                            mimeType: 'application/json'
                        }))
                    };
                },
                complete: {
                    sessionId: async () => this.getSessionIds()
                }
            }),
            {
                title: 'Diagram Model Structure',
                description:
                    'Get the complete GLSP model (GModelRoot) for a session as a JSON structure. ' +
                    'Includes all nodes, edges, and their properties.',
                mimeType: 'application/json'
            },
            async (_uri, params) => this.getDiagramModel(params)
        );
    }

    // --- Resource Handlers ---

    protected async getAllSessions(): Promise<ReadResourceResult> {
        const sessions = this.clientSessionManager.getSessions();
        const sessionsList = sessions.map(session => {
            const modelState = session.container.get<ModelState>(ModelState);
            return {
                sessionId: session.id,
                diagramType: session.diagramType,
                sourceUri: modelState.sourceUri,
                readOnly: modelState.isReadonly
            };
        });

        return {
            contents: [
                {
                    uri: 'glsp://sessions',
                    mimeType: 'application/json',
                    text: JSON.stringify({ sessions: sessionsList }, undefined, 2)
                }
            ]
        };
    }

    protected async getSessionInfo(params: Record<string, string | string[]>): Promise<ReadResourceResult> {
        const sessionId = extractParam(params, 'sessionId');
        if (!sessionId) {
            return { contents: [] };
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return { contents: [] };
        }

        const modelState = session.container.get<ModelState>(ModelState);
        const sessionInfo = {
            sessionId: session.id,
            diagramType: session.diagramType,
            sourceUri: modelState.sourceUri,
            readOnly: modelState.isReadonly
        };

        return {
            contents: [
                {
                    uri: `glsp://sessions/${sessionId}`,
                    mimeType: 'application/json',
                    text: JSON.stringify(sessionInfo, undefined, 2)
                }
            ]
        };
    }

    protected async getDiagramTypesList(): Promise<ReadResourceResult> {
        const diagramTypes = Array.from(this.diagramModules.keys());

        return {
            contents: [
                {
                    uri: 'glsp://types',
                    mimeType: 'application/json',
                    text: JSON.stringify({ diagramTypes }, undefined, 2)
                }
            ]
        };
    }

    protected async getElementTypes(params: Record<string, string | string[]>): Promise<ReadResourceResult> {
        const diagramType = extractParam(params, 'diagramType');
        if (!diagramType) {
            return { contents: [] };
        }

        // Try to get a session of this diagram type to access the operation handler registry
        const sessions = this.clientSessionManager.getSessionsByType(diagramType);
        if (sessions.length === 0) {
            return {
                contents: [
                    {
                        uri: `glsp://types/${diagramType}/elements`,
                        mimeType: 'application/json',
                        text: JSON.stringify(
                            {
                                diagramType,
                                nodeTypes: [],
                                edgeTypes: [],
                                message: 'No active session found for this diagram type. Create a session first to discover element types.'
                            },
                            undefined,
                            2
                        )
                    }
                ]
            };
        }

        const session = sessions[0];
        const registry = session.container.get<OperationHandlerRegistry>(OperationHandlerRegistry);

        const nodeTypes: Array<{ id: string; label: string }> = [];
        const edgeTypes: Array<{ id: string; label: string }> = [];

        for (const key of registry.keys()) {
            const handler = registry.get(key);
            if (handler && CreateOperationHandler.is(handler)) {
                if (key.startsWith('createNode_')) {
                    const elementTypeId = key.substring('createNode_'.length);
                    nodeTypes.push({ id: elementTypeId, label: elementTypeId });
                } else if (key.startsWith('createEdge_')) {
                    const elementTypeId = key.substring('createEdge_'.length);
                    edgeTypes.push({ id: elementTypeId, label: elementTypeId });
                }
            }
        }

        return {
            contents: [
                {
                    uri: `glsp://types/${diagramType}/elements`,
                    mimeType: 'application/json',
                    text: JSON.stringify({ diagramType, nodeTypes, edgeTypes }, undefined, 2)
                }
            ]
        };
    }

    protected async getDiagramModel(params: Record<string, string | string[]>): Promise<ReadResourceResult> {
        const sessionId = extractParam(params, 'sessionId');
        if (!sessionId) {
            return { contents: [] };
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return { contents: [] };
        }

        const modelState = session.container.get<ModelState>(ModelState);
        const serializer = session.container.get<GModelSerializer>(GModelSerializer);

        const schema = serializer.createSchema(modelState.root);

        return {
            contents: [
                {
                    uri: `glsp://diagrams/${sessionId}/model`,
                    mimeType: 'application/json',
                    text: JSON.stringify(schema, undefined, 2)
                }
            ]
        };
    }

    // --- Utility Methods ---

    protected async getSessionIds(): Promise<string[]> {
        return this.clientSessionManager.getSessions().map(s => s.id);
    }

    protected async getDiagramTypes(): Promise<string[]> {
        return Array.from(this.diagramModules.keys());
    }
}
