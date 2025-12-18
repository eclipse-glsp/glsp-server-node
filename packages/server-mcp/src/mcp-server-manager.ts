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
    InitializeParameters,
    InitializeResult,
    Logger,
    McpInitializeResult,
    McpServerConfiguration,
    getMcpServerConfig
} from '@eclipse-glsp/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { inject, injectable, multiInject, optional } from 'inversify';
import { AddressInfo } from 'net';
import { McpClientSession, McpHttpServerWithSessions } from './http-server-with-sessions';
import { McpServerContribution } from './mcp-server-contribution';

export type FullMcpServerConfiguration = Required<McpServerConfiguration>;

export interface GLSPMcpServer extends Pick<McpServer, 'registerPrompt' | 'registerResource' | 'registerTool'> {}

@injectable()
export class McpServerManager implements GLSPServerInitContribution, GLSPServerListener, Disposable {
    @inject(Logger) protected logger: Logger;

    protected toDispose = new DisposableCollection();
    protected serverUrl: string;

    constructor(@multiInject(McpServerContribution) @optional() protected contributions: McpServerContribution[] = []) {}

    async initializeServer(server: GLSPServer, params: InitializeParameters, result: McpInitializeResult): Promise<InitializeResult> {
        const mcpServerParam = getMcpServerConfig(params);
        if (!mcpServerParam) {
            return result;
        }

        const { port = 0, host = '127.0.0.1', route = '/glsp-mcp', name = 'glspMcpServer' } = mcpServerParam;
        const mcpServerConfig: FullMcpServerConfiguration = { port, host, route, name };

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

    protected createMcpServer({ name }: FullMcpServerConfiguration): McpServer {
        const server = new McpServer({ name, version: '1.0.0' }, { capabilities: { logging: {} } });
        const glspMcpServer: GLSPMcpServer = {
            registerPrompt: server.registerPrompt.bind(server),
            registerResource: server.registerResource.bind(server),
            registerTool: server.registerTool.bind(server)
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
