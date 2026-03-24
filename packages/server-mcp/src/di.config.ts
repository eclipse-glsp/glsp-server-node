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
import { bindAsService, GLSPServerInitContribution, GLSPServerListener } from '@eclipse-glsp/server';
import { ContainerModule } from 'inversify';
import {
    DefaultMcpModelSerializer,
    DiagramModelMcpResourceHandler,
    DiagramPngMcpResourceHandler,
    ElementTypesMcpResourceHandler,
    McpModelSerializer,
    McpResourceContribution,
    SessionsListMcpResourceHandler
} from './resources';
import {
    DefaultMcpIdAliasService,
    DummyMcpIdAliasService,
    McpIdAliasService,
    McpResourceHandler,
    McpServerContribution,
    McpServerManager,
    McpToolHandler
} from './server';
import {
    ChangeViewMcpToolHandler,
    CreateEdgesMcpToolHandler,
    CreateNodesMcpToolHandler,
    DeleteElementsMcpToolHandler,
    DiagramElementsMcpToolHandler,
    GetSelectionMcpToolHandler,
    McpToolContribution,
    ModifyEdgesMcpToolHandler,
    ModifyNodesMcpToolHandler,
    RedoMcpToolHandler,
    SaveModelMcpToolHandler,
    UndoMcpToolHandler,
    ValidateDiagramMcpToolHandler
} from './tools';
import { FEATURE_FLAGS } from './feature-flags';

export function configureMcpServerModule(): ContainerModule {
    return new ContainerModule(bind => {
        bind(McpServerManager).toSelf().inSingletonScope();
        bind(GLSPServerInitContribution).toService(McpServerManager);
        bind(GLSPServerListener).toService(McpServerManager);

        if (FEATURE_FLAGS.aliasIds) {
            bind(McpIdAliasService).to(DefaultMcpIdAliasService).inSingletonScope();
        } else {
            bind(McpIdAliasService).to(DummyMcpIdAliasService).inSingletonScope();
        }

        bind(McpModelSerializer).to(DefaultMcpModelSerializer).inSingletonScope();

        // Resources
        bindAsService(bind, McpResourceHandler, SessionsListMcpResourceHandler);
        bindAsService(bind, McpResourceHandler, ElementTypesMcpResourceHandler);
        bindAsService(bind, McpResourceHandler, DiagramModelMcpResourceHandler);
        bindAsService(bind, McpResourceHandler, DiagramPngMcpResourceHandler);

        bindAsService(bind, McpServerContribution, McpResourceContribution);

        // Tools
        bindAsService(bind, McpToolHandler, CreateNodesMcpToolHandler);
        bindAsService(bind, McpToolHandler, CreateEdgesMcpToolHandler);
        bindAsService(bind, McpToolHandler, DeleteElementsMcpToolHandler);
        bindAsService(bind, McpToolHandler, SaveModelMcpToolHandler);
        bindAsService(bind, McpToolHandler, ValidateDiagramMcpToolHandler);
        bindAsService(bind, McpToolHandler, DiagramElementsMcpToolHandler);
        bindAsService(bind, McpToolHandler, ModifyNodesMcpToolHandler);
        bindAsService(bind, McpToolHandler, ModifyEdgesMcpToolHandler);
        bindAsService(bind, McpToolHandler, UndoMcpToolHandler);
        bindAsService(bind, McpToolHandler, RedoMcpToolHandler);
        bindAsService(bind, McpToolHandler, GetSelectionMcpToolHandler);
        bindAsService(bind, McpToolHandler, ChangeViewMcpToolHandler);

        bindAsService(bind, McpServerContribution, McpToolContribution);
    });
}
