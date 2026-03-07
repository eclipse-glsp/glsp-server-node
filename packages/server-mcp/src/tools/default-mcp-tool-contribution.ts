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

import { MarkersReason } from '@eclipse-glsp/protocol';
import { ClientSessionManager, Logger } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpServerContribution } from '../server';
import { McpToolCreationHandler } from './handlers/creation-handler';
import { McpToolDeletionHandler } from './handlers/deletion-handler';
import { McpToolModelHandler } from './handlers/model-handler';
import { McpToolValidationHandler } from './handlers/validation-handler';

/**
 * Default MCP server contribution that provides tools for performing actions on
 * GLSP diagrams, including validation and element creation.
 *
 * This contribution can be overridden to customize or extend tool functionality.
 */
@injectable()
export class DefaultMcpToolContribution implements McpServerContribution {
    @inject(Logger) protected logger: Logger;
    @inject(ClientSessionManager) protected clientSessionManager: ClientSessionManager;

    @inject(McpToolValidationHandler)
    protected validationHandler: McpToolValidationHandler;
    @inject(McpToolCreationHandler)
    protected creationHandler: McpToolCreationHandler;
    @inject(McpToolDeletionHandler)
    protected deletionHandler: McpToolDeletionHandler;
    @inject(McpToolModelHandler)
    protected modelHandler: McpToolModelHandler;

    configure(server: GLSPMcpServer): void {
        this.registerValidateDiagramTool(server);
        this.registerCreateNodeTool(server);
        this.registerCreateEdgeTool(server);
        this.registerDeleteElementTool(server);
        this.registerSaveTool(server);
    }

    protected registerValidateDiagramTool(server: GLSPMcpServer): void {
        server.registerTool(
            'validate-diagram',
            {
                description:
                    'Validate diagram elements and return validation markers (errors, warnings, info). ' +
                    'Triggers active validation computation. Use elementIds parameter to validate specific elements, ' +
                    'or omit to validate the entire model.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID to validate'),
                    elementIds: z
                        .array(z.string())
                        .optional()
                        .describe('Array of element IDs to validate. If not provided, validates entire model starting from root.'),
                    reason: z
                        .enum([MarkersReason.BATCH, MarkersReason.LIVE])
                        .optional()
                        .default(MarkersReason.LIVE)
                        .describe('Validation reason: "batch" for thorough validation, "live" for quick incremental checks')
                }
            },
            params => this.validationHandler.validateDiagram(params)
        );
    }

    protected registerCreateNodeTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-node',
            {
                description:
                    'Create a new node element in the diagram at a specified location. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Query glsp://types/{diagramType}/elements resource to discover valid element type IDs.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the node should be created'),
                    elementTypeId: z
                        .string()
                        .describe(
                            'Element type ID (e.g., "task:manual", "task:automated"). ' +
                                'Use element-types resource to discover valid IDs.'
                        ),
                    location: z
                        .object({
                            x: z.number().describe('X coordinate in diagram space'),
                            y: z.number().describe('Y coordinate in diagram space')
                        })
                        .describe('Position where the node should be created (absolute diagram coordinates)'),
                    containerId: z.string().optional().describe('ID of the container element. If not provided, node is added to the root.'),
                    args: z
                        .record(z.string(), z.any())
                        .optional()
                        .describe('Additional type-specific arguments for node creation (varies by element type)')
                }
            },
            params => this.creationHandler.createNode(params)
        );
    }

    protected registerCreateEdgeTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-edge',
            {
                description:
                    'Create a new edge connecting two elements in the diagram. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Query glsp://types/{diagramType}/elements resource to discover valid edge type IDs.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the edge should be created'),
                    elementTypeId: z
                        .string()
                        .describe('Edge type ID (e.g., "edge", "transition"). Use element-types resource to discover valid IDs.'),
                    sourceElementId: z.string().describe('ID of the source element (must exist in the diagram)'),
                    targetElementId: z.string().describe('ID of the target element (must exist in the diagram)'),
                    args: z
                        .record(z.string(), z.any())
                        .optional()
                        .describe('Additional type-specific arguments for edge creation (varies by edge type)')
                }
            },
            params => this.creationHandler.createEdge(params)
        );
    }

    protected registerDeleteElementTool(server: GLSPMcpServer): void {
        server.registerTool(
            'delete-element',
            {
                description:
                    'Delete one or more elements (nodes or edges) from the diagram. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Automatically handles dependent elements (e.g., deleting a node also deletes connected edges).',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the elements should be deleted'),
                    elementIds: z.array(z.string()).min(1).describe('Array of element IDs to delete. Must include at least one element ID.')
                }
            },
            params => this.deletionHandler.deleteElement(params)
        );
    }

    protected registerSaveTool(server: GLSPMcpServer): void {
        server.registerTool(
            'save-model',
            {
                description:
                    'Save the current diagram model to persistent storage. ' +
                    'This operation persists all changes back to the source model. ' +
                    'Optionally specify a new fileUri to save to a different location.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the model should be saved'),
                    fileUri: z
                        .string()
                        .optional()
                        .describe('Optional destination file URI. If not provided, saves to the original source model location.')
                }
            },
            params => this.modelHandler.saveModel(params)
        );
    }
}
