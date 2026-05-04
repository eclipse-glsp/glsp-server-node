/********************************************************************************
 * Copyright (c) 2025-2026 EclipseSource and others.
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

import { ActionDispatcher, ClientSessionManager, RequestAction, ResponseAction } from '@eclipse-glsp/server';
import { CallToolResult, GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types';

/**
 * **Note on terminology** — "session" in this file always refers to a **GLSP client session**
 * (one open diagram, tracked by core's `ClientSessionManager`). It is unrelated to the
 * **MCP session** concept used in {@link mcp-session.ts} and {@link mcp-http-transport.ts}
 * (one MCP client connection to the HTTP endpoint). The two have independent lifetimes — see
 * the docstring at the top of `mcp-session.ts` for the full disambiguation.
 *
 * Diagram-scope handler bases ({@link AbstractMcpDiagramToolHandler} et al.) inject their per-session
 * services directly per GLSP session. The launcher's dispatcher resolves the
 * {@link McpDiagramScopedInput.sessionId} input field via `ClientSessionManager` to route a
 * tool/resource/prompt call to the right per-session handler instance.
 */

// ─── MCP-protocol type aliases (Mcp prefix on GLSP-side) ─────────────────────

/** Result returned from `tools/call`. Aliased so handler signatures read in GLSP terms. */
export type McpToolResult = CallToolResult;
/** Result returned from `resources/read`. Aliased so handler signatures read in GLSP terms. */
export type McpResourceResult = ReadResourceResult;
/** Result returned from `prompts/get`. Aliased so handler signatures read in GLSP terms. */
export type McpPromptResult = GetPromptResult;
/** One content part of a {@link McpToolResult}. Tool results are an array of these. */
export type McpToolResultContent = CallToolResult['content'][number];
/** One content part of a {@link McpResourceResult}. Resource reads are an array of these. */
export type McpResourceResultContent = ReadResourceResult['contents'][number];

/**
 * Single-content body returned by a session-scope resource handler. The base wraps it with
 * `uri` + the handler's declared `mimeType` to produce the SDK `ReadResourceResult`.
 *
 * `structured` is dual-emit overflow used only when the resource is exposed as a tool
 * (`toolAlternativeInputSchema` set) AND the handler also declares `toolAlternativeOutputSchema`.
 * The framework forwards it to `CallToolResult.structuredContent`. Resource-protocol reads ignore
 * it — the spec has no equivalent slot on `ReadResourceResult`.
 */
export type McpResourceContent = ({ text: string } | { blob: string }) & { structured?: McpStructuredContent };

/** Structured payload for `CallToolResult.structuredContent`. The MCP spec requires an object. */
export interface McpStructuredContent {
    [key: string]: unknown;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * Throw inside `createResult` to surface an expected, user-facing error to the MCP client.
 * The base class catches it and emits an `isError: true` result. Unexpected errors
 * (non-`McpToolError`) are logged and their extracted message is surfaced too.
 *
 * Use one of the named subclasses (`McpMissingParamError`, `McpSessionNotFoundError`,
 * `McpReadOnlyError`, `McpElementsNotFoundError`, `McpRequestTimeoutError`) where they fit;
 * otherwise throw `new McpToolError('context-specific message')`.
 */
export class McpToolError extends Error {
    constructor(
        message: string,
        readonly cause?: unknown
    ) {
        super(message);
        this.name = 'McpToolError';
    }
}

/** Thrown when a required input parameter is missing or empty. */
export class McpMissingParamError extends McpToolError {
    constructor(readonly paramName: string) {
        super(`No '${paramName}' provided.`);
        this.name = 'McpMissingParamError';
    }
}

/** Thrown when no GLSP client session matches the provided id. */
export class McpSessionNotFoundError extends McpToolError {
    constructor(readonly sessionId: string) {
        super(`Session not found: ${sessionId}`);
        this.name = 'McpSessionNotFoundError';
    }
}

/** Thrown when a write-style operation targets a read-only model. */
export class McpReadOnlyError extends McpToolError {
    constructor() {
        super('Model is read-only.');
        this.name = 'McpReadOnlyError';
    }
}

/** Thrown by handlers that look up elements by id and find some absent from the model. */
export class McpElementsNotFoundError extends McpToolError {
    constructor(readonly missingIds: readonly string[]) {
        super(`Element(s) not found: ${missingIds.join(', ')}`);
        this.name = 'McpElementsNotFoundError';
    }
}

/** Thrown when a request/response round-trip (`ActionDispatcher.requestUntil`) exceeds its timeout. */
export class McpRequestTimeoutError extends McpToolError {
    constructor(
        readonly operation: string,
        readonly timeoutMs: number
    ) {
        super(`${operation} timed out after ${timeoutMs}ms.`);
        this.name = 'McpRequestTimeoutError';
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Catch `McpToolError` thrown by pre-handler routing (e.g. `requireDiagramToolHandler`) and
 * convert it to an `isError: true` tool result. Without this, those throws surface as
 * JSON-RPC `-32603` instead of a self-correctable tool error.
 */
export async function runWithToolErrorEnvelope(producer: () => Promise<CallToolResult>): Promise<CallToolResult> {
    try {
        return await producer();
    } catch (err: unknown) {
        if (err instanceof McpToolError) {
            return toolErrorResult(err.message, errorCodeFor(err));
        }
        throw err;
    }
}

/** Stable codes surfaced in `CallToolResult.structuredContent.code` so the LLM can self-correct on a known taxonomy. */
export const McpToolErrorCodes = {
    /** GLSP session disposed mid-call (server shutdown or session disposal). */
    SessionDisposed: 'session-disposed'
} as const;
export type McpToolErrorCode = (typeof McpToolErrorCodes)[keyof typeof McpToolErrorCodes];

/** True when `err` is a GLSP-session-disposed rejection from the action dispatcher's dispose hooks. */
export function isSessionDisposedError(err: unknown): boolean {
    if (!(err instanceof Error)) {
        return false;
    }
    return /ActionDispatcher disposed|cancelled: dispatcher disposed/.test(err.message);
}

/** Resolve a known `McpToolErrorCode` for an error, or `undefined` if it is generic. */
export function errorCodeFor(err: unknown): McpToolErrorCode | undefined {
    if (isSessionDisposedError(err)) {
        return McpToolErrorCodes.SessionDisposed;
    }
    return undefined;
}

/** Build an `isError: true` tool result, attaching `structuredContent: { code }` when known. */
export function toolErrorResult(message: string, code?: McpToolErrorCode): CallToolResult {
    return {
        isError: true,
        content: [{ type: 'text', text: message }],
        ...(code ? { structuredContent: { code } } : {})
    };
}

/** Returns a useful message for a value caught from a `throw`. */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}

/**
 * Dispatch a request action and await its response, surfacing failures uniformly.
 *
 * The `ActionDispatcher.requestUntil` API today returns `undefined` on timeout (default
 * `rejectOnTimeout: false`) and throws when the client emits a `RejectAction`. Handlers
 * that consume it have to branch on both. This helper consolidates that branching:
 *
 * -   On client-side `RejectAction` → throws `McpToolError` with `${label} failed: <inner>`.
 * -   On timeout (undefined return) → throws `McpRequestTimeoutError(label, timeoutMs)`.
 * -   Otherwise → returns the typed response.
 *
 * Prefer the base-class methods (`OperationMcpDiagramToolHandler.requestAction` /
 * `AbstractMcpDiagramResourceHandler.requestAction`) over calling this directly — they default
 * the label to the handler's `name` field and pass `this.actionDispatcher`. This free
 * function is the canonical implementation behind both.
 */
export async function requestActionOrFail<R extends ResponseAction>(
    dispatcher: ActionDispatcher,
    request: RequestAction<R>,
    timeoutMs: number,
    label: string
): Promise<R> {
    let response: R | undefined;
    try {
        response = await dispatcher.requestUntil<R>(request, timeoutMs);
    } catch (err: unknown) {
        // Preserve the original rejection error as `cause` so adopters whose `RejectAction`
        // sets `detail` (which core flattens into the message via `${message}: ${detail}`) can
        // still inspect the underlying object — both for diagnostic logging and for an LLM
        // surface that wants to disambiguate transient vs. permanent failures.
        throw new McpToolError(`${label} failed: ${extractErrorMessage(err)}`, err);
    }
    if (!response) {
        throw new McpRequestTimeoutError(label, timeoutMs);
    }
    return response;
}

/**
 * Pick a target session for server-scope handlers (e.g. prompts) where `sessionId` is optional.
 * Resolution: explicit id (validated to exist) → single open session → throw with the available
 * ids when ambiguous, throw when none open. Keeps user-invoked entry points like slash-command
 * prompts ergonomic in the common single-diagram case while staying explicit when not.
 */
export function resolveActiveSessionId(clientSessionManager: ClientSessionManager, explicitSessionId: string | undefined): string {
    const sessions = clientSessionManager.getSessions();
    if (explicitSessionId) {
        if (!sessions.some(session => session.id === explicitSessionId)) {
            throw new McpToolError(`Unknown sessionId: ${explicitSessionId}`);
        }
        return explicitSessionId;
    }
    if (sessions.length === 0) {
        throw new McpToolError('No open diagram sessions to target.');
    }
    if (sessions.length === 1) {
        return sessions[0].id;
    }
    const ids = sessions.map(session => `'${session.id}'`).join(', ');
    throw new McpToolError(`Multiple sessions open (${ids}); pass \`sessionId\` to disambiguate.`);
}
