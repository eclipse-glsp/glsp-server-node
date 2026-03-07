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

import { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types';
import { ResourceHandlerResult } from '../server';

/**
 * Extracts a single parameter value from MCP resource template parameters.
 * Parameters can be either a string or an array of strings.
 *
 * @param params The parameter record from the resource template
 * @param key The parameter key to extract
 * @returns The first value if it's an array, or the value directly if it's a string
 */
export function extractResourceParam(params: Record<string, string | string[]>, key: string): string | undefined {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Wraps the result of a resource handler ({@link ResourceHandlerResult}) into a result for an
 * MCP resource endpoint ({@link ReadResourceResult}).
 */
export function createResourceResult(result: ResourceHandlerResult): ReadResourceResult {
    return {
        contents: [result.content]
    };
}

/**
 * Wraps the result of a resource handler ({@link ResourceHandlerResult}) into a result for an
 * MCP tool endpoint ({@link ReadResourceResult}). This is necessary if the server is configured
 * to provide no resources and only tools (as some MCP clients may require this).
 */
export function createResourceToolResult(result: ResourceHandlerResult): CallToolResult {
    return {
        isError: result.isError,
        content: [
            {
                type: 'resource',
                resource: result.content
            }
        ]
    };
}

export function createToolResult(text: string, isError: boolean): CallToolResult {
    return {
        isError,
        content: [
            {
                type: 'text',
                text
            }
        ]
    };
}
