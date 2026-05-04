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

import { BindingTarget } from '@eclipse-glsp/server';
import {
    DefaultMcpDiagramModule,
    DefaultMcpServerModule,
    ElementTypesProvider,
    McpLabelProvider,
    McpModelSerializer
} from '@eclipse-glsp/server-mcp';
import { WorkflowElementTypesProvider } from './workflow-element-types-provider';
import { WorkflowMcpLabelProvider } from './workflow-mcp-label-provider';
import { WorkflowMcpModelSerializer } from './workflow-mcp-model-serializer';

/**
 * Workflow-specific server-scope MCP module. Currently no server-scope customizations beyond
 * the defaults — every diagram-type-specific override lives on {@link WorkflowMcpDiagramModule}.
 * Kept as the named entry point and as a hook for future server-scope extensions.
 */
export class WorkflowMcpServerModule extends DefaultMcpServerModule {}

/**
 * Workflow-specific diagram-scope MCP module — swaps in the workflow-aware
 * {@link McpLabelProvider}, {@link McpModelSerializer}, and {@link ElementTypesProvider}.
 * `LayoutMcpToolHandler` ships in the default tool set and self-skips when no `LayoutEngine`
 * is bound, so workflow doesn't need to add it explicitly.
 */
export class WorkflowMcpDiagramModule extends DefaultMcpDiagramModule {
    protected override bindLabelProvider(): BindingTarget<McpLabelProvider> {
        return WorkflowMcpLabelProvider;
    }

    protected override bindModelSerializer(): BindingTarget<McpModelSerializer> {
        return WorkflowMcpModelSerializer;
    }

    protected override bindElementTypesProvider(): BindingTarget<ElementTypesProvider> {
        return WorkflowElementTypesProvider;
    }
}
