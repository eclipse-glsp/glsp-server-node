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

import { MaybePromise } from '@eclipse-glsp/server';
import { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types';
import { GLSPMcpServer } from './mcp-server-manager';

export interface McpServerContribution {
    configure(server: GLSPMcpServer): MaybePromise<void>;
}
export const McpServerContribution = Symbol('McpServerContribution');

export type ToolResultContent = CallToolResult['content'][number];
export type ResourceResultContent = ReadResourceResult['contents'][number];

export interface ResourceHandlerResult {
    content: ResourceResultContent;
    isError: boolean;
}

/**
 * An `McpResourceHandler` defines a resource for the MCP server. This includes
 * not only the logic to execute but also the definition of the endpoint. As
 * it may be the case that resources should be offered as tools for compatibility
 * purposes, both kinds of endpoints need to be defined.
 */
export interface McpResourceHandler {
    /** Defines the endpoint and registers the resource with the given MCP server as a resource*/
    registerResource(server: GLSPMcpServer): void;
    /** Defines the endpoint and registers the resource with the given MCP server as a tool */
    registerTool(server: GLSPMcpServer): void;
    /** Executes the logic given the endpoints input and provides corresponding output */
    handle(params: Record<string, any>): Promise<ResourceHandlerResult>;
}
export const McpResourceHandler = Symbol('McpResourceHandler');

/**
 * An `McpToolHandler` defines a tools for the MCP server. This includes
 * not only the logic to execute but also the definition of the endpoint.
 */
export interface McpToolHandler {
    /** Defines the endpoint and registers the tool with the given MCP server */
    registerTool(server: GLSPMcpServer): void;
    /** Executes the logic given the endpoints input and provides corresponding output */
    handle(params: Record<string, any>): Promise<CallToolResult>;
}
export const McpToolHandler = Symbol('McpToolHandler');
