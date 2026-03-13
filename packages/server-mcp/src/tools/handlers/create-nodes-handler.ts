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
    ApplyLabelEditOperation,
    ClientSessionManager,
    CreateNodeOperation,
    GLabel,
    GModelElement,
    Logger,
    ModelState
} from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import * as z from 'zod/v4';
import { GLSPMcpServer, McpIdAliasService, McpToolHandler } from '../../server';
import { createToolResult, createToolResultJson } from '../../util';
import { FEATURE_FLAGS } from '../../feature-flags';

/**
 * Creates one or multiple new nodes in the given session's model.
 */
@injectable()
export class CreateNodesMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-nodes',
            {
                description:
                    'Create one or multiple new nodes element in the diagram at a specified position. ' +
                    'When creating new nodes absolutely consider the visual alignment with existing nodes. ' +
                    'This operation modifies the diagram state and requires user approval. ' +
                    'Query glsp://types/{diagramType}/elements resource to discover valid element type IDs.',
                inputSchema: {
                    sessionId: z.string().describe('Session ID where the node should be created'),
                    nodes: z
                        .array(
                            z.object({
                                elementTypeId: z
                                    .string()
                                    .describe(
                                        'Element type ID (e.g., "task:manual", "task:automated"). ' +
                                            'Use element-types resource to discover valid IDs.'
                                    ),
                                position: z
                                    .object({
                                        x: z.number().describe('X coordinate in diagram space'),
                                        y: z.number().describe('Y coordinate in diagram space')
                                    })
                                    .describe('Position where the node should be created (absolute diagram coordinates)'),
                                text: z.string().optional().describe('Label text to use in case the given element type allows for labels.'),
                                containerId: z
                                    .string()
                                    .optional()
                                    .describe('ID of the container element. If not provided, node is added to the root.'),
                                args: z
                                    .record(z.string(), z.any())
                                    .optional()
                                    .describe('Additional type-specific arguments for node creation (varies by element type)')
                            })
                        )
                        .min(1)
                        .describe('Array of nodes to create. Must include at least one node.')
                },
                outputSchema: FEATURE_FLAGS.useJson
                    ? z.object({
                          nodeIds: z.array(z.string()).describe('List of IDs of the created nodes.'),
                          errors: z.array(z.string()).optional().describe('List of errors encountered.'),
                          nrOfCommands: z.number().describe('The number of commands executed in the course of this tool call.')
                      })
                    : undefined
            },
            params => this.handle(params)
        );
    }

    async handle({
        sessionId,
        nodes
    }: {
        sessionId: string;
        nodes: {
            elementTypeId: string;
            position: { x: number; y: number };
            text?: string;
            containerId?: string;
            args?: Record<string, any>;
        }[];
    }): Promise<CallToolResult> {
        this.logger.info(`'create-nodes' invoked for session '${sessionId}' with ${nodes.length} nodes`);

        if (!sessionId) {
            return createToolResult('No session id provided.', true);
        }
        if (!nodes || !nodes.length) {
            return createToolResult('No nodes provided.', true);
        }

        const session = this.clientSessionManager.getSession(sessionId);
        if (!session) {
            return createToolResult('Session not found', true);
        }

        const modelState = session.container.get<ModelState>(ModelState);
        if (modelState.isReadonly) {
            return createToolResult('Model is read-only', true);
        }

        const mcpIdAliasService = session.container.get<McpIdAliasService>(McpIdAliasService);

        // Snapshot element IDs before operation
        let beforeIds = modelState.index.allIds();

        const errors: string[] = [];
        const successIds: string[] = [];
        let dispatchedOperations = 0;
        // Since we need sequential handling of the created elements, we can't call all in parallel
        for (const node of nodes) {
            const { elementTypeId, position, text, args } = node;
            const containerId = node.containerId ? mcpIdAliasService.lookup(sessionId, node.containerId) : undefined;

            // Using the name "position" instead of "location", as this is the name in the element's properties
            // This just ensures that the AI sees a coherent API with common naming
            // Here in the code, we can just reassign anyway
            const operation = CreateNodeOperation.create(elementTypeId, { location: position, containerId, args });
            // Wait for the operation to be handled so the new ID is present
            await session.actionDispatcher.dispatch(operation);
            dispatchedOperations++;

            // Snapshot element IDs after operation
            const afterIds = modelState.index.allIds();

            // Find new element ID by filtering only the newly added ones...
            const newIds = afterIds.filter(id => !beforeIds.includes(id));
            // ...and in case that multiple exist (i.e., derived elements were created as well),
            // assume that the first new ID represents the actually relevant element
            const newElementId = newIds.length > 0 ? newIds[0] : undefined;

            // For the next iteration, use the new snapshot as the baseline
            beforeIds = afterIds;

            // We can't directly know whether an operation failed, because there are no
            // direct responses, but if we see no new ID, we can assume it failed
            if (!newElementId) {
                errors.push(`Node creation likely failed because no new element ID was found for input: ${JSON.stringify(node)}`);
                continue;
            }

            const newElementLabelId = this.getCorrespondingLabelId(modelState.index.get(newElementId));
            // If it is indeed labeled (and we actually want to set the label)...
            if (newElementLabelId && text) {
                // ...then use an already existing operation to set the label
                const editLabelOperation = ApplyLabelEditOperation.create({ labelId: newElementLabelId, text });
                await session.actionDispatcher.dispatch(editLabelOperation);
                dispatchedOperations++;
            }

            successIds.push(mcpIdAliasService.alias(sessionId, newElementId));
        }

        if (FEATURE_FLAGS.useJson) {
            const content = {
                nodeIds: successIds,
                errors: errors.length ? errors : undefined,
                nrOfCommands: dispatchedOperations
            };

            return createToolResultJson(content);
        }

        // Create a failure string if any errors occurred
        let failureStr = '';
        if (errors.length) {
            const failureListStr = errors.map(error => `- ${error}\n`);
            failureStr = `\nThe following errors occured:\n${failureListStr}`;
        }

        const successListStr = successIds.map(successId => `- ${successId}`).join('\n');
        // Even if every input given yields an error, the MCP call was still successful technically (even if not semantically)
        // Otherwise, we would need some kind of transaction to rollback successful creations, which would be a great technical challenge
        return createToolResult(
            `Successfully created ${successIds.length} node(s) (in ${dispatchedOperations} commands) ` +
                `with the element IDs:\n${successListStr}${failureStr}`,
            false
        );
    }

    /**
     * This method provides the label ID for a labelled node's label.
     *
     * While it can be generally assumed that labelled nodes contain those labels
     * as direct children, some custom elements may wrap their labels in intermediary
     * container nodes. However, in the likely scenario that a specific GLSP implementation
     * requires no further changes to this handler except extracting nested labels, this
     * function serves as an easy entrypoint without a full override.
     */
    protected getCorrespondingLabelId(element: GModelElement): string | undefined {
        return element.children.find(child => child instanceof GLabel)?.id;
    }
}
