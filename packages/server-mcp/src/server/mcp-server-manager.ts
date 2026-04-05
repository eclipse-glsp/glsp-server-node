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

import {
    Disposable,
    DisposableCollection,
    GLSPServer,
    GLSPServerInitContribution,
    GLSPServerListener,
    InitializeResult,
    Logger,
    McpInitializeParameters,
    McpInitializeResult,
    McpServerConfiguration,
    McpServerOptions,
    getMcpServerConfig
} from '@eclipse-glsp/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { inject, injectable, multiInject, optional } from 'inversify';
import { AddressInfo } from 'net';
import { McpClientSession, McpHttpServerWithSessions } from './http-server-with-sessions';
import { McpServerContribution } from './mcp-server-contribution';

export type FullMcpServerConfiguration = Required<McpServerConfiguration>;

export interface GLSPMcpServer extends Pick<McpServer, 'registerPrompt' | 'registerResource' | 'registerTool'> {
    options: McpServerOptions;
}

const DEFAULT_AGENT_PERSONA = `
You are the GLSP Modeling Agent. Your primary goal is to assist in the creation and modification of graphical models using the  
GLSP MCP server. You have to adhere to the following principles:
- MCP-Interaction: Any modeling related activity has to occur using the MCP server.
- Real Data: The diagram model is the ground truth regarding the existing graphical model. Always query it before modifying the diagram.
- Real Creation: Consult the available element types before creating elements.
- Visual Proof: An image of the graphical model can be created, if you deem it useful for calculating or verifying layout decisions.
- Precision: All IDs and types must be exact.
- Visualization: When creating nodes, suggest sensible default positions and avoid visual overlapping.
- Careful: Under no circumstances save the model without explicit instruction. If you deem it sensible, you may ask the user for permission.
  The same goes for Undo/Redo operations.
- Layouting: If available, make use of automatic layouting when not given explicit custom layouting requirements. 
`;

@injectable()
export class McpServerManager implements GLSPServerInitContribution, GLSPServerListener, Disposable {
    @inject(Logger) protected logger: Logger;

    protected toDispose = new DisposableCollection();
    protected serverUrl: string;

    constructor(@multiInject(McpServerContribution) @optional() protected contributions: McpServerContribution[] = []) {}

    async initializeServer(server: GLSPServer, params: McpInitializeParameters, result: McpInitializeResult): Promise<InitializeResult> {
        const mcpServerParam = getMcpServerConfig(params);
        if (!mcpServerParam) {
            return result;
        }

        // use a fixed default port instead of 0 so that the MCP server need only be registered once
        // using 0, i.e., a random port, would require re-registering the MCP server each time
        const { port = 60000, host = '127.0.0.1', route = '/glsp-mcp', name = 'glspMcpServer', options = {} } = mcpServerParam;
        const optionsWithDefaults = { resources: options.resources ?? false, aliasIds: options.aliasIds ?? true };
        const mcpServerConfig: FullMcpServerConfiguration = { port, host, route, name, options: optionsWithDefaults };

        const httpServer = new McpHttpServerWithSessions(this.logger);
        httpServer.onSessionInitialized(client => this.onSessionInitialized(client, mcpServerConfig));
        this.toDispose.push(httpServer);

        const address = await httpServer.start(mcpServerConfig);
        this.serverUrl = this.toServerUrl(address, route);
        this.logger.info(`MCP server '${mcpServerConfig.name}' is ready to accept new client requests on: ${this.serverUrl}`);
        result.mcpServer = { name: mcpServerConfig.name, url: this.serverUrl };
        return result;
    }

    protected toServerUrl({ address, family, port }: AddressInfo, route: string, protocol = 'http'): string {
        const host = address === '::' || address === '0.0.0.0' ? 'localhost' : family === 'IPv6' ? `[${address}]` : address;
        return `${protocol}://${host}:${port}${route}`;
    }

    protected onSessionInitialized(client: McpClientSession, config: FullMcpServerConfiguration): void {
        this.logger.info(`MCP session initialized with ID: ${client.sessionId}`);
        const server = this.createMcpServer(config);
        // server assumes control of the connection
        server.connect(client);
        this.toDispose.push(Disposable.create(() => server.close()));
    }

    protected createMcpServer({ name, options }: FullMcpServerConfiguration): McpServer {
        const server = new McpServer(
            { name, version: '1.0.0' },
            { capabilities: { logging: {} }, instructions: options.agentPersona ?? DEFAULT_AGENT_PERSONA }
        );
        const glspMcpServer: GLSPMcpServer = {
            registerPrompt: server.registerPrompt.bind(server),
            registerResource: server.registerResource.bind(server),
            registerTool: server.registerTool.bind(server),
            options
        };
        this.contributions.forEach(contribution => contribution.configure(glspMcpServer));
        return server;
    }

    serverShutDown(server: GLSPServer): void {
        this.dispose();
    }

    dispose(): void {
        this.toDispose.dispose();
        this.toDispose.clear();
    }
}
