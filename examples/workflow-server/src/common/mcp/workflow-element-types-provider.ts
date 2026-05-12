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
import { ElementTypeEntry, ElementTypes, ElementTypesProvider } from '@eclipse-glsp/server-mcp';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';

const NODE_TYPES: ElementTypeEntry[] = [
    { id: ModelTypes.AUTOMATED_TASK, label: 'Automated Task', description: 'Task without human input', acceptsText: true },
    { id: ModelTypes.MANUAL_TASK, label: 'Manual Task', description: 'Task done by a human', acceptsText: true },
    { id: ModelTypes.JOIN_NODE, label: 'Join Node', description: 'Gateway that merges parallel flows', acceptsText: false },
    { id: ModelTypes.FORK_NODE, label: 'Fork Node', description: 'Gateway that splits into parallel flows', acceptsText: false },
    { id: ModelTypes.MERGE_NODE, label: 'Merge Node', description: 'Gateway that merges alternative flows', acceptsText: false },
    { id: ModelTypes.DECISION_NODE, label: 'Decision Node', description: 'Gateway that splits into alternative flows', acceptsText: false },
    { id: ModelTypes.CATEGORY, label: 'Category', description: 'Container node that groups other elements', acceptsText: true }
];

const EDGE_TYPES: ElementTypeEntry[] = [
    { id: DefaultTypes.EDGE, label: 'Edge', description: 'Standard control flow edge', acceptsText: false },
    {
        id: ModelTypes.WEIGHTED_EDGE,
        label: 'Weighted Edge',
        description: 'Edge that indicates a weighted probability. Typically used with a Decision Node.',
        acceptsText: false
    }
];

/**
 * Workflow-specific {@link ElementTypesProvider}. Returns the constant set of creatable types
 * with richer LLM-facing fields (`description`, `acceptsText`) than the default registry-scrape
 * impl can infer. Bound on the workflow MCP diagram module via `bindElementTypesProvider()`;
 * the standard `element-types` tool handler exposes the full entries via `structuredContent`
 * (with a short summary in the text content) — no handler rebind needed.
 */
@injectable()
export class WorkflowElementTypesProvider implements ElementTypesProvider {
    get(): ElementTypes {
        return { nodeTypes: NODE_TYPES, edgeTypes: EDGE_TYPES };
    }
}
