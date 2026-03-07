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

import { ClientSessionManager, CreateEdgeOperation, CreateNodeOperation, Logger, ModelState } from '@eclipse-glsp/server';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { inject, injectable } from 'inversify';
import { createToolResult } from '../../util';

export const McpToolCreationHandler = Symbol('McpToolCreationHandler');

/**
 * The `McpToolCreationHandler`
 */
export interface McpToolCreationHandler {
    createNode(params: {
        sessionId: string;
        elementTypeId: string;
        location: { x: number; y: number };
        containerId?: string;
        args?: Record<string, any>;
    }): Promise<CallToolResult>;

    createEdge(params: {
        sessionId: string;
        elementTypeId: string;
        sourceElementId: string;
        targetElementId: string;
        args?: Record<string, any>;
    }): Promise<CallToolResult>;
}

@injectable()
export class DefaultMcpToolCreationHandler implements McpToolCreationHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    async createNode({
        sessionId,
        elementTypeId,
        location,
        containerId,
        args
    }: {
        sessionId: string;
        elementTypeId: string;
        location: { x: number; y: number };
        containerId?: string;
        args?: Record<string, any>;
    }): Promise<CallToolResult> {
        this.logger.info(`createNode invoked for session ${sessionId}`);

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
                return createToolResult('Node creation succeeded but could not determine element ID', true);
            }

            return createToolResult(`Node created successfully with element ID: ${newElementId}`, false);
        } catch (error) {
            this.logger.error('Node creation failed', error);
            return createToolResult(`Node creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }

    async createEdge({
        sessionId,
        elementTypeId,
        sourceElementId,
        targetElementId,
        args
    }: {
        sessionId: string;
        elementTypeId: string;
        sourceElementId: string;
        targetElementId: string;
        args?: Record<string, any>;
    }): Promise<CallToolResult> {
        this.logger.info(`createEdge invoked for session ${sessionId}`);

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

            // Validate source and target exist
            const source = modelState.index.find(sourceElementId);
            if (!source) {
                return createToolResult(`Source element not found: ${sourceElementId}`, true);
            }

            const target = modelState.index.find(targetElementId);
            if (!target) {
                return createToolResult(`Target element not found: ${targetElementId}`, true);
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
                return createToolResult('Edge creation succeeded but could not determine element ID', true);
            }

            return createToolResult(`Edge created successfully with element ID: ${newElementId}`, false);
        } catch (error) {
            this.logger.error('Edge creation failed', error);
            return createToolResult(`Edge creation failed: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
}
