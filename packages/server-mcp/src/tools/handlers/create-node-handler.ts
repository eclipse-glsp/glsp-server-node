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
import { GLSPMcpServer, McpToolHandler } from '../../server';
import { createToolResult } from '../../util';

/**
 * Creates a new node in the given session's model.
 */
@injectable()
export class CreateNodeMcpToolHandler implements McpToolHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(
            'create-node',
            {
                description:
                    'Create a new node element in the diagram at a specified position. ' +
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
                }
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
        this.logger.info(`CreateNodeMcpToolHandler invoked for session ${sessionId}`);

        try {
            const session = this.clientSessionManager.getSession(sessionId);
            if (!session) {
                return createToolResult('Session not found', true);
            }

            const modelState = session.container.get<ModelState>(ModelState);

            // Check if model is readonly
            if (modelState.isReadonly) {
                return createToolResult('Model is read-only', true);
            }

            // Snapshot element IDs before operation using index.allIds()
            let beforeIds = new Set(modelState.index.allIds());

            const failures = [];
            const successIds = [];
            // Since we need sequential handling of the created elements, we can't call all in parallel
            for (const node of nodes) {
                const { elementTypeId, position, text, containerId, args } = node;

                // Create operation
                // Using the name "position" instead of "location", as this is the name in the elements properties
                const operation = CreateNodeOperation.create(elementTypeId, { location: position, containerId, args });

                // Dispatch operation
                await session.actionDispatcher.dispatch(operation);

                // Snapshot element IDs after operation
                const afterIds = modelState.index.allIds();

                // Find new element ID
                const newIds = afterIds.filter(id => !beforeIds.has(id));
                const newElementId = newIds.length > 0 ? newIds[0] : undefined;

                beforeIds = new Set(afterIds);

                if (!newElementId) {
                    failures.push(node);
                    continue;
                }

                const newElementLabelId = this.getCorrespondingLabelId(modelState.index.get(newElementId));
                // If it is indeed labeled (and we actually want to set the label)...
                if (newElementLabelId && text) {
                    // ...then use an already existing operation to set the label
                    const editLabelOperation = ApplyLabelEditOperation.create({ labelId: newElementLabelId, text });
                    await session.actionDispatcher.dispatch(editLabelOperation);
                }

                successIds.push(newElementId);
            }

            let failureStr = '';
            if (failures.length) {
                const failureListStr = failures.map(failure => `- ${JSON.stringify(failure)}\n`);
                failureStr = `\nThe following inputs likely failed, because no new element ID could be determined:\n${failureListStr}`;
            }

            const successListStr = successIds.map(successId => `- ${successId}`).join('\n');
            return createToolResult(`Nodes created successfully with the element IDs:\n${successListStr}${failureStr}`, false);
        } catch (error) {
            this.logger.error('Node creation failed', error);
            return createToolResult(`Node creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }

    protected getCorrespondingLabelId(element: GModelElement): string | undefined {
        // Assume that generally, labelled nodes have those labels as direct children
        return element.children.find(child => child instanceof GLabel)?.id;
    }
}
