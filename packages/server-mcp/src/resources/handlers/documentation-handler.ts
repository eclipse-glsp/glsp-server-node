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
import { ContainerModule, inject, injectable } from 'inversify';
import { ResourceHandlerResult } from '../../server';
import { objectArrayToMarkdownTable } from '../../util';

export const McpResourceDocumentationHandler = Symbol('McpResourceDocumentationHandler');

/**
 * The `McpResourceDocumentationHandler` provides handler functions supplying information about diagrams,
 * their available elements, and other general information. This is independent from the current state of any given diagram.
 */
export interface McpResourceDocumentationHandler {
    /**
     * Lists the available diagram types.
     */
    getDiagramTypes(): string[];

    /**
     * Lists the available element types. This should likely include not only their id but also some description.
     * Additionally, some element types may not be creatable and should be omitted or annotated as such.
     * @param diagramType The diagram type to query the element types for.
     */
    getElementTypes(diagramType: string | undefined): ResourceHandlerResult;
}

@injectable()
export class DefaultMcpResourceDocumentationHandler implements McpResourceDocumentationHandler {
    @inject(Logger)
    protected logger: Logger;

    @inject(DiagramModules)
    protected diagramModules: Map<string, ContainerModule[]>;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    getDiagramTypes(): string[] {
        return Array.from(this.diagramModules.keys());
    }

    getElementTypes(diagramType: string | undefined): ResourceHandlerResult {
        this.logger.info(`getElementTypes invoked for diagram type ${diagramType}`);
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

        const result = [
            `# Creatable element types for ${diagramType} diagrams`,
            '## Node Types',
            objectArrayToMarkdownTable(nodeTypes),
            '## Edge Types',
            objectArrayToMarkdownTable(edgeTypes)
        ].join('\n');

        return {
            content: {
                uri: `glsp://types/${diagramType}/elements`,
                mimeType: 'text/markdown',
                text: result
            },
            isError: false
        };
    }
}
