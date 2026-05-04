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

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * **Note on terminology** — the word "session" is overloaded in this codebase. Two
 * independent concepts exist and must not be conflated:
 *
 * 1. **MCP session** (this file): one MCP client connection to the MCP HTTP endpoint, tracked by
 *    {@link McpHttpTransport.sessions} keyed by the SDK-issued `mcp-session-id` HTTP header.
 *    Created in `onsessioninitialized`, supports resumability across reconnects via
 *    `Last-Event-ID`. Each {@link McpSession} corresponds to one underlying SDK `McpServer`
 *    instance — multiple LLM clients can connect simultaneously, each with its own MCP session
 *    and its own SDK server.
 *
 * 2. **GLSP client session** (core): one open diagram, tracked by core's `ClientSessionManager`
 *    and represented by `ClientSession`. Tools/resources/prompts that target a specific diagram
 *    receive the GLSP session id via `params.sessionId` in their input schema.
 *
 * The two are independent in lifetime and cardinality: a single MCP session sees ALL open GLSP
 * sessions; a single GLSP session is visible to every connected MCP session. Names in this
 * package distinguish them: anything with the `Mcp` prefix in {@link mcp-session.ts} or
 * `mcp-http-transport.ts` is MCP-side; anything talking about diagrams (`AbstractMcpDiagram*`,
 * `requireGlspSession`, `GlspSession`) is GLSP-side.
 */
export type McpSessionId = string;

export type WithSessionId<T> = T & { get sessionId(): McpSessionId };

/** SDK {@link Transport} widened with the session-id accessor every concrete MCP transport carries post-handshake. */
export type McpSession = WithSessionId<Transport>;
