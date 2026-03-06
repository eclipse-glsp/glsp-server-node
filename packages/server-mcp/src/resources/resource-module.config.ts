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
import { FEATURE_FLAGS } from '../feature-flags';
import { McpServerContribution } from '../server';
import { DefaultMcpResourceContribution } from './default-mcp-resource-contribution';
import { DefaultMcpResourceToolContribution } from './default-mcp-resource-tool-contribution';
import { DefaultMcpResourceDocumentationHandler, McpResourceDocumentationHandler } from './handlers/documentation-handler';
import { DefaultMcpResourcePngHandler, McpResourcePngHandler } from './handlers/export-png-handler';
import { DefaultMcpResourceModelHandler, McpResourceModelHandler } from './handlers/model-handler';
import { DefaultMcpResourceSessionHandler, McpResourceSessionHandler } from './handlers/session-handler';
import { DefaultMcpModelSerializer, McpModelSerializer } from './services/mcp-model-serializer';

export function configureMcpResourceModule(): ContainerModule {
    return new ContainerModule(bind => {
        bindAsService(bind, McpModelSerializer, DefaultMcpModelSerializer);

        bindAsService(bind, McpResourceDocumentationHandler, DefaultMcpResourceDocumentationHandler);
        bindAsService(bind, McpResourceSessionHandler, DefaultMcpResourceSessionHandler);
        bindAsService(bind, McpResourceModelHandler, DefaultMcpResourceModelHandler);
        bindAsService(bind, McpResourcePngHandler, DefaultMcpResourcePngHandler);

        // TODO currently only development tool
        // think of nice switching mechanism for starting MCP servers with only tools or tools + resources
        if (FEATURE_FLAGS.useResources) {
            bindAsService(bind, McpServerContribution, DefaultMcpResourceContribution);
        } else {
            bindAsService(bind, McpServerContribution, DefaultMcpResourceToolContribution);
        }
    });
}
