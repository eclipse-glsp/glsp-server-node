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

import { DefaultTypes } from '@eclipse-glsp/server';
import {
    createResourceToolResult,
    ElementTypesMcpResourceHandler,
    GLSPMcpServer,
    objectArrayToMarkdownTable,
    ResourceHandlerResult
} from '@eclipse-glsp/server-mcp';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';
import * as z from 'zod/v4';

interface ElementType {
    id: string;
    label: string;
    description: string;
    hasLabel: boolean;
}

const WORKFLOW_NODE_ELEMENT_TYPES: ElementType[] = [
    {
        id: ModelTypes.AUTOMATED_TASK,
        label: 'Automated Task',
        description: 'Task without human input',
        hasLabel: true
    },
    {
        id: ModelTypes.MANUAL_TASK,
        label: 'Manual Task',
        description: 'Task done by a human',
        hasLabel: true
    },
    {
        id: ModelTypes.JOIN_NODE,
        label: 'Join Node',
        description: 'Gateway that merges parallel flows',
        hasLabel: false
    },
    {
        id: ModelTypes.FORK_NODE,
        label: 'Fork Node',
        description: 'Gateway that splits into parallel flows',
        hasLabel: false
    },
    {
        id: ModelTypes.MERGE_NODE,
        label: 'Merge Node',
        description: 'Gateway that merges alternative flows',
        hasLabel: false
    },
    {
        id: ModelTypes.DECISION_NODE,
        label: 'Decision Node',
        description: 'Gateway that splits into alternative flows',
        hasLabel: false
    },
    {
        id: ModelTypes.CATEGORY,
        label: 'Category',
        description: 'Container node that groups other elements',
        hasLabel: true
    }
];
const WORKFLOW_EDGE_ELEMENT_TYPES: ElementType[] = [
    {
        id: DefaultTypes.EDGE,
        label: 'Edge',
        description: 'Standard control flow edge',
        hasLabel: false
    },
    {
        id: ModelTypes.WEIGHTED_EDGE,
        label: 'Weighted Edge',
        description: 'Edge that indicates a weighted probability. Typically used with a Decision Node.',
        hasLabel: false
    }
];

const WORKFLOW_ELEMENT_TYPES_STRING = [
    '# Creatable element types for diagram type "workflow-diagram"',
    '## Node Types',
    objectArrayToMarkdownTable(WORKFLOW_NODE_ELEMENT_TYPES),
    '## Edge Types',
    objectArrayToMarkdownTable(WORKFLOW_EDGE_ELEMENT_TYPES)
].join('\n');

/**
 * The default {@link ElementTypesMcpResourceHandler} extracts a list of operations generically from
 * the `OperationHandlerRegistry`, because it can't know the details of a specific GLSP implementation.
 * This is naturally quite limited in expression and relies on semantically meaningful model types to be
 * able to inform an MCP client reliably.
 *
 * However, when overriding this for a specific implementation, we don't have those limitations. Rather,
 * since the available element types do not change dynamically, we can simply provide a statically generated
 * string.
 */
@injectable()
export class WorkflowElementTypesMcpResourceHandler extends ElementTypesMcpResourceHandler {
    override registerTool(server: GLSPMcpServer): void {
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
            async params => createResourceToolResult(await this.handle(params))
        );
    }

    override async handle({ diagramType }: { diagramType?: string }): Promise<ResourceHandlerResult> {
        this.logger.info(`'element-types' invoked for diagram type '${diagramType}'`);

        // In this specifc GLSP implementation, only 'workflow-diagram' is valid
        if (diagramType !== 'workflow-diagram') {
            return {
                content: {
                    uri: `glsp://types/${diagramType}/elements`,
                    mimeType: 'text/plain',
                    text: 'Invalid diagram type.'
                },
                isError: true
            };
        }

        return {
            content: {
                uri: `glsp://types/${diagramType}/elements`,
                mimeType: 'text/markdown',
                text: WORKFLOW_ELEMENT_TYPES_STRING
            },
            isError: false
        };
    }
}
