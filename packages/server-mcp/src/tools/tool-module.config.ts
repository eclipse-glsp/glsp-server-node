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
import { bindAsService } from '@eclipse-glsp/server';
import { ContainerModule } from 'inversify';
import { McpServerContribution, McpToolHandler } from '../server';
import { CreateEdgeMcpToolHandler } from './handlers/create-edge-handler';
import { CreateNodeMcpToolHandler } from './handlers/create-node-handler';
import { DeleteElementMcpToolHandler } from './handlers/delete-element-handler';
import { DiagramElementMcpToolHandler } from './handlers/diagram-element-handler';
import { ModifyNodesMcpToolHandler } from './handlers/modify-nodes-handler';
import { SaveModelMcpToolHandler } from './handlers/save-model-handler';
import { ValidateDiagramMcpToolHandler } from './handlers/validate-diagram-handler';
import { McpToolContribution } from './mcp-tool-contribution';

export function configureMcpToolModule(): ContainerModule {
    return new ContainerModule(bind => {
        bindAsService(bind, McpToolHandler, CreateNodeMcpToolHandler);
        bindAsService(bind, McpToolHandler, CreateEdgeMcpToolHandler);
        bindAsService(bind, McpToolHandler, DeleteElementMcpToolHandler);
        bindAsService(bind, McpToolHandler, SaveModelMcpToolHandler);
        bindAsService(bind, McpToolHandler, ValidateDiagramMcpToolHandler);
        bindAsService(bind, McpToolHandler, DiagramElementMcpToolHandler);
        bindAsService(bind, McpToolHandler, ModifyNodesMcpToolHandler);

        bindAsService(bind, McpServerContribution, McpToolContribution);
    });
}
