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

import { expect } from 'vitest';
import { McpToolResult } from '../../../server/mcp-handler-shared';
import { BaseMcpToolHandler } from '../../../server/mcp-tool-handler';

/**
 * Asserts that a tool result satisfies the handler's declared `outputSchema`. The MCP SDK runs
 * this check on every `tools/call` and replaces the result with an error result when it fails,
 * which a spec calling `createResult` directly does not exercise.
 *
 * Takes the handler rather than a schema so the assertion is always made against the schema the
 * handler actually declares.
 */
export function expectValidStructuredContent(handler: Pick<BaseMcpToolHandler, 'outputSchema'>, result: McpToolResult): void {
    const schema = handler.outputSchema;
    expect(schema, 'handler declares no outputSchema, so there is nothing to validate against').toBeDefined();
    const parsed = schema!.safeParse(result.structuredContent);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
}
