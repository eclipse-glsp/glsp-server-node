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

import { DeleteElementOperation, MarkersReason, RedoAction, SaveModelAction, UndoAction } from '@eclipse-glsp/protocol';
import {
    ClientSessionManager,
    CommandStack,
    CreateEdgeOperation,
    CreateNodeOperation,
    Logger,
    ModelState,
    ModelValidator
} from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { McpServerContribution } from './mcp-server-contribution';
import { GLSPMcpServer } from './mcp-server-manager';
import { createToolError, createToolSuccess } from './mcp-util';

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

    configure(server: GLSPMcpServer): void {
        this.registerValidateDiagramTool(server);
        this.registerCreateNodeTool(server);
        this.registerCreateEdgeTool(server);
        this.registerDeleteElementTool(server);
        this.registerUndoTool(server);
        this.registerRedoTool(server);
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
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether validation completed successfully'),
                    markers: z
                        .array(
                            z.object({
                                label: z.string().describe('Short label for the validation issue'),
                                description: z.string().describe('Full description of the validation issue'),
                                elementId: z.string().describe('ID of the element with the issue'),
                                kind: z.enum(['info', 'warning', 'error']).describe('Severity of the validation issue')
                            })
                        )
                        .describe('Array of validation markers found'),
                    message: z.string().optional().describe('Additional information (e.g., "No validator configured")')
                })
            },
            params => this.validateDiagram(params)
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
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether node creation succeeded'),
                    elementId: z.string().optional().describe('ID of the newly created node'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.createNode(params)
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
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether edge creation succeeded'),
                    elementId: z.string().optional().describe('ID of the newly created edge'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.createEdge(params)
        );
    }

    // --- Tool Handlers ---

    protected async validateDiagram(params: any): Promise<CallToolResult> {
        const { sessionId, elementIds, reason } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Try to get ModelValidator (it's optional)
            let validator: ModelValidator | undefined;
            try {
                validator = session.container.get<ModelValidator>(ModelValidator);
            } catch (error) {
                // No validator bound - this is acceptable
            }

            if (!validator) {
                return createToolSuccess({
                    markers: [],
                    message: 'No validator configured for this diagram type'
                });
            }

            // Determine which elements to validate
            const idsToValidate = elementIds && elementIds.length > 0 ? elementIds : [modelState.root.id];

            // Get elements from index
            const elements = modelState.index.getAll(idsToValidate);

            // Run validation
            const markers = await validator.validate(elements, reason ?? MarkersReason.BATCH);

            return createToolSuccess({ markers });
        } catch (error) {
            this.logger.error('Validation failed', error);
            return createToolError('Validation failed', { message: error instanceof Error ? error.message : String(error) });
        }
    }

    protected async createNode(params: any): Promise<CallToolResult> {
        const { sessionId, elementTypeId, location, containerId, args } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolError('Model is read-only', { sessionId });
            }

            // Snapshot element IDs before operation using index.allIds()
            const beforeIds = new Set(modelState.index.allIds());

            // Create operation
            const operation = CreateNodeOperation.create(elementTypeId, { location, containerId, args });

            // Dispatch operation
            await session.actionDispatcher.dispatch(operation);

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID
            const newIds = afterIds.filter(id => !beforeIds.has(id));
            const newElementId = newIds.length > 0 ? newIds[0] : undefined;

            if (!newElementId) {
                return createToolError('Node creation succeeded but could not determine element ID');
            }

            return createToolSuccess({
                elementId: newElementId,
                message: 'Node created successfully'
            });
        } catch (error) {
            this.logger.error('Node creation failed', error);
            return createToolError('Node creation failed', { message: error instanceof Error ? error.message : String(error) });
        }
    }

    protected async createEdge(params: any): Promise<CallToolResult> {
        const { sessionId, elementTypeId, sourceElementId, targetElementId, args } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolError('Model is read-only', { sessionId });
            }

            // Validate source and target exist
            const source = modelState.index.find(sourceElementId);
            if (!source) {
                return createToolError('Source element not found', { sourceElementId });
            }

            const target = modelState.index.find(targetElementId);
            if (!target) {
                return createToolError('Target element not found', { targetElementId });
            }

            // Snapshot element IDs before operation using index.allIds()
            const beforeIds = new Set(modelState.index.allIds());

            // Create operation
            const operation = CreateEdgeOperation.create({ elementTypeId, sourceElementId, targetElementId, args });

            // Dispatch operation
            await session.actionDispatcher.dispatch(operation);

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID
            const newIds = afterIds.filter(id => !beforeIds.has(id));
            const newElementId = newIds.length > 0 ? newIds[0] : undefined;

            if (!newElementId) {
                return createToolError('Edge creation succeeded but could not determine element ID');
            }

            return createToolSuccess({
                elementId: newElementId,
                message: 'Edge created successfully'
            });
        } catch (error) {
            this.logger.error('Edge creation failed', error);
            return createToolError('Edge creation failed', { message: error instanceof Error ? error.message : String(error) });
        }
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
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether element deletion succeeded'),
                    deletedCount: z.number().optional().describe('Number of elements deleted (including dependents)'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.deleteElement(params)
        );
    }

    protected async deleteElement(params: any): Promise<CallToolResult> {
        const { sessionId, elementIds } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolError('Model is read-only', { sessionId });
            }

            // Validate elements exist
            const missingIds: string[] = [];
            for (const elementId of elementIds) {
                const element = modelState.index.find(elementId);
                if (!element) {
                    missingIds.push(elementId);
                }
            }

            if (missingIds.length > 0) {
                return createToolError('Some elements not found', { missingIds });
            }

            // Snapshot element count before operation
            const beforeCount = modelState.index.allIds().length;

            // Create and dispatch delete operation
            const operation = DeleteElementOperation.create(elementIds);
            await session.actionDispatcher.dispatch(operation);

            // Calculate how many elements were deleted (including dependents)
            const afterCount = modelState.index.allIds().length;
            const deletedCount = beforeCount - afterCount;

            return createToolSuccess({
                deletedCount,
                message: `Successfully deleted ${deletedCount} element(s) (including dependents)`
            });
        } catch (error) {
            this.logger.error('Element deletion failed', error);
            return createToolError('Element deletion failed', { message: error instanceof Error ? error.message : String(error) });
        }
    }

    protected registerUndoTool(server: GLSPMcpServer): void {
        server.registerTool(
            'undo',
            {
                description: 'Undo the last executed command in the diagram. Reverts the most recent change made to the model.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where undo should be performed')
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether undo succeeded'),
                    canUndo: z.boolean().describe('Whether there are more commands to undo'),
                    canRedo: z.boolean().describe('Whether there are commands that can be redone'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.undo(params)
        );
    }

    protected async undo(params: any): Promise<CallToolResult> {
        const { sessionId } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolError('Model is read-only', { sessionId });
            }

            const commandStack = session.container.get<CommandStack>(CommandStack);

            if (!commandStack.canUndo()) {
                return createToolError('Nothing to undo', { canUndo: false, canRedo: commandStack.canRedo() });
            }

            // Dispatch undo action
            const action = UndoAction.create();
            await session.actionDispatcher.dispatch(action);

            return createToolSuccess({
                canUndo: commandStack.canUndo(),
                canRedo: commandStack.canRedo(),
                message: 'Undo successful'
            });
        } catch (error) {
            this.logger.error('Undo failed', error);
            return createToolError('Undo failed', { message: error instanceof Error ? error.message : String(error) });
        }
    }

    protected registerRedoTool(server: GLSPMcpServer): void {
        server.registerTool(
            'redo',
            {
                description: 'Redo the last undone command in the diagram. Re-applies the most recently undone change.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where redo should be performed')
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether redo succeeded'),
                    canUndo: z.boolean().describe('Whether there are commands to undo'),
                    canRedo: z.boolean().describe('Whether there are more commands that can be redone'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.redo(params)
        );
    }

    protected async redo(params: any): Promise<CallToolResult> {
        const { sessionId } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolError('Model is read-only', { sessionId });
            }

            const commandStack = session.container.get<CommandStack>(CommandStack);

            if (!commandStack.canRedo()) {
                return createToolError('Nothing to redo', { canUndo: commandStack.canUndo(), canRedo: false });
            }

            // Dispatch redo action
            const action = RedoAction.create();
            await session.actionDispatcher.dispatch(action);

            return createToolSuccess({
                canUndo: commandStack.canUndo(),
                canRedo: commandStack.canRedo(),
                message: 'Redo successful'
            });
        } catch (error) {
            this.logger.error('Redo failed', error);
            return createToolError('Redo failed', { message: error instanceof Error ? error.message : String(error) });
        }
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
                },
                outputSchema: z.object({
                    success: z.boolean().describe('Whether save succeeded'),
                    isDirty: z.boolean().describe('Whether the model is still dirty after save (should be false on success)'),
                    message: z.string().describe('Success or error message'),
                    error: z.string().optional().describe('Error message if operation failed'),
                    details: z.any().optional().describe('Additional error details')
                })
            },
            params => this.saveModel(params)
        );
    }

    protected async saveModel(params: any): Promise<CallToolResult> {
        const { sessionId, fileUri } = params;

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolError('Session not found', { sessionId });
            }

            const commandStack = session.container.get<CommandStack>(CommandStack);

            // Check if there are unsaved changes
            if (!commandStack.isDirty) {
                return createToolSuccess({
                    isDirty: false,
                    message: 'No changes to save'
                });
            }

            // Dispatch save action
            const action = SaveModelAction.create({ fileUri });
            await session.actionDispatcher.dispatch(action);

            return createToolSuccess({
                isDirty: commandStack.isDirty,
                message: 'Model saved successfully'
            });
        } catch (error) {
            this.logger.error('Save failed', error);
            return createToolError('Save failed', { message: error instanceof Error ? error.message : String(error) });
        }
    }
}
