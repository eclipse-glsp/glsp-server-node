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

import { CallToolResult } from '@modelcontextprotocol/sdk/types';

/**
 * Extracts a single parameter value from MCP resource template parameters.
 * Parameters can be either a string or an array of strings.
 *
 * @param params The parameter record from the resource template
 * @param key The parameter key to extract
 * @returns The first value if it's an array, or the value directly if it's a string
 */
export function extractParam(params: Record<string, string | string[]>, key: string): string | undefined {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Creates a tool result with both text and structured content.
 * This generic function handles both success and error cases consistently.
 *
 * @param data The data to include in the response
 * @returns A CallToolResult with the provided data in both text and structured form
 */
export function createToolResult<T extends Record<string, any>>(data: T): CallToolResult {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(data, undefined, 2)
            }
        ],
        structuredContent: data
    };
}

/**
 * Creates a successful tool result with both text and structured content.
 * Includes a `success: true` flag and spreads the provided data.
 *
 * @param data Additional data to include in the success response
 * @returns A CallToolResult with success status and the provided data
 */
export function createToolSuccess<T extends Record<string, any> = Record<string, any>>(data: T): CallToolResult {
    return createToolResult({ success: true, ...data });
}

/**
 * Creates an error tool result with both text and structured content.
 * Includes a `success: false` flag, error message, and optional details.
 *
 * @param message The error message
 * @param details Optional additional error details
 * @returns A CallToolResult with error status and details
 */
export function createToolError<T extends Record<string, any> = Record<string, any>>(message: string, details?: T): CallToolResult {
    return createToolResult({ success: false, message, error: message, ...(details && { details }) });
}
