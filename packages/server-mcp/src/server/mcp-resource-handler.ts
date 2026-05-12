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

import { ActionDispatcher, ClientId, Logger, MaybePromise, ModelState, RequestAction, ResponseAction } from '@eclipse-glsp/server';
import { CompleteResourceTemplateCallback, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { Annotations, ListResourcesResult, Role } from '@modelcontextprotocol/sdk/types.js';
import { inject, injectable, interfaces } from 'inversify';
import { ZodObject, ZodRawShape } from 'zod/v4';
import { GLSPMcpServer } from './glsp-mcp-server';
import {
    McpResourceContent,
    McpResourceResult,
    McpResourceResultContent,
    McpToolError,
    McpToolResult,
    extractErrorMessage,
    requestActionOrFail
} from './mcp-handler-shared';
import { McpIdAliasService } from './mcp-id-alias-service';
import { McpDiagramScopedInput } from './mcp-input-schemas';
import { McpMimeType } from './mcp-mime-types';
import { mcpRequestContext } from './mcp-request-context';

/**
 * Multi-binding key for **server-scope** resource handlers — singletons that don't target a
 * specific GLSP client session. For diagram-scope resources see
 * {@link McpDiagramResourceHandlerConstructor}.
 *
 * @experimental
 */
export interface McpResourceHandler {
    registerResource(server: GLSPMcpServer): void;
    /** Optional tool fallback for clients that don't speak the resources protocol. */
    registerToolAlternative?(server: GLSPMcpServer): void;
}
export const McpResourceHandler = Symbol('McpResourceHandler');

/** Static URI (string) or templated URI (`{ template: string }`). The base branches on shape. */
export type McpResourceUri = string | { template: string };

/** Shared infrastructure for both server- and diagram-scope resource handlers. */
@injectable()
abstract class BaseMcpResourceHandler {
    @inject(Logger) protected logger: Logger;

    /**
     * Resource identifier exposed to the MCP client. Also used to reference this resource from
     * other handlers' prompt or description text — wire via `static readonly NAME = '…'` and
     * `readonly name = ClassName.NAME` so those cross-references survive renames.
     */
    abstract readonly name: string;
    /** LLM-facing explanation surfaced in the resource catalog. Keep concise — clients pass this verbatim to the model. */
    abstract readonly description: string;
    /** MIME type of the resource body. Adopters typically use one of {@link McpMimeType}'s common values; any string the MCP SDK accepts is valid. */
    abstract readonly mimeType: McpMimeType;
    /** Static URI string for fixed resources, or `{ template: string }` for templated URIs (e.g. `glsp://diagrams/{sessionId}/model`). */
    abstract readonly uri: McpResourceUri;
    /** Optional human-friendly display name for UIs that render a friendlier label than `name`. */
    readonly title?: string;

    // ─── Resource annotations (MCP spec: server/resources#annotations) ────────────
    // Surfaced as flat fields rather than a nested `annotations` object so adopters can
    // override one hint with a one-line `override readonly priority = 0.8;` instead of
    // re-declaring the whole triple. Mirror the {@link BaseMcpToolHandler} pattern.
    // **Untrusted** unless from a trusted server — clients MUST treat these as advisory.

    /**
     * Intended audience(s) — `"user"` (display the rendered content), `"assistant"` (use as model
     * context), or both. Clients use it to filter/route the resource.
     */
    readonly audience?: Role[];
    /** Importance, 0.0–1.0. Clients use it to prioritize inclusion in context. */
    readonly priority?: number;
    /** ISO 8601 timestamp of last meaningful change. Omit when the server has no clean freshness signal. */
    readonly lastModified?: string;

    /**
     * Assembles the {@link Annotations} object the SDK expects from the flat-field surface.
     * Returns `undefined` when no field is set so `resources/list` entries don't carry an
     * empty `annotations: {}`.
     */
    toAnnotations(): Annotations | undefined {
        if (this.audience === undefined && this.priority === undefined && this.lastModified === undefined) {
            return undefined;
        }
        return {
            ...(this.audience !== undefined ? { audience: this.audience } : {}),
            ...(this.priority !== undefined ? { priority: this.priority } : {}),
            ...(this.lastModified !== undefined ? { lastModified: this.lastModified } : {})
        };
    }

    /**
     * Set to a `z.object({...})` schema to also expose the resource as a tool fallback (for MCP
     * clients that don't speak the resources protocol). Field shape mirrors `inputSchema` on
     * tool handlers — declarative, no extra method.
     */
    readonly toolAlternativeInputSchema?: ZodObject<ZodRawShape>;

    /**
     * Optional dual-emit output schema applied **only** in tool-alternative mode (when
     * {@link toolAlternativeInputSchema} is set). When declared, the handler should populate
     * `structured` on the returned {@link McpResourceContent} so the framework can forward it
     * to `CallToolResult.structuredContent`. Resource-protocol reads ignore this — the spec
     * has no equivalent slot on `ReadResourceResult`.
     */
    readonly toolAlternativeOutputSchema?: ZodObject<ZodRawShape>;

    /** Override for templated URIs — enumerate matching resources. */
    list?(): MaybePromise<ListResourcesResult>;
    /** Override for templated URIs — completers per template variable. */
    complete?(): Record<string, CompleteResourceTemplateCallback>;

    /** Resolve `this.uri` (which may be a fixed string or a template object) to a template string. */
    protected uriTemplate(): string {
        return typeof this.uri === 'string' ? this.uri : this.uri.template;
    }

    /**
     * Replace `{key}` placeholders in the URI template with the supplied values, single-pass
     * (no re-expansion of substituted text) and `encodeURIComponent`-escaped. Unmatched keys
     * pass through verbatim so the caller can spot them.
     */
    protected expandUriTemplate(vars: Record<string, string>): string {
        return this.uriTemplate().replace(/\{(\w+)\}/g, (placeholder, key) => {
            const value = vars[key];
            return value === undefined ? placeholder : encodeURIComponent(value);
        });
    }

    /** Catches `McpToolError` (→ surfaced as text content + isError) and unexpected errors. */
    protected async execute(producer: () => MaybePromise<McpResourceContent>): Promise<ResourceExecutionResult> {
        try {
            return { ok: true, body: await producer() };
        } catch (err: unknown) {
            if (err instanceof McpToolError) {
                return { ok: false, message: err.message };
            }
            const message = extractErrorMessage(err);
            this.logger.error(`Unexpected error in resource '${this.name}': ${message}`, err);
            return { ok: false, message };
        }
    }

    /** Wraps the body returned by {@link createResult} with `uri` + `mimeType` for the SDK. */
    toResourceResult(uri: string, result: ResourceExecutionResult): McpResourceResult {
        if (!result.ok) {
            return { contents: [{ uri, mimeType: 'text/plain', text: result.message }], isError: true };
        }
        const content: McpResourceResultContent =
            'text' in result.body
                ? { uri, mimeType: this.mimeType, text: result.body.text }
                : { uri, mimeType: this.mimeType, blob: result.body.blob };
        return { contents: [content], isError: false };
    }

    /** Converts the body to a `CallToolResult` for tool-alternative mode. Image MIMEs render as `image` content. */
    toToolResult(result: ResourceExecutionResult): McpToolResult {
        if (!result.ok) {
            return { isError: true, content: [{ type: 'text', text: result.message }] };
        }
        const structuredContent = result.body.structured;
        const baseContent: McpToolResult =
            'text' in result.body
                ? { isError: false, content: [{ type: 'text', text: result.body.text }] }
                : { isError: false, content: [{ type: 'image', data: result.body.blob, mimeType: this.mimeType }] };
        return structuredContent ? { ...baseContent, structuredContent } : baseContent;
    }

    /** Builds the SDK `ResourceTemplate` for templated URIs (server-scope path). */
    protected buildResourceTemplate(template: string): ResourceTemplate {
        return new ResourceTemplate(template, {
            list: this.list ? async extra => mcpRequestContext.run(extra, () => this.list!()) : undefined,
            complete: this.complete?.()
        });
    }
}

export type ResourceExecutionResult = { ok: true; body: McpResourceContent } | { ok: false; message: string };

/**
 * Server-scope resource base — for resources that don't target a specific GLSP client session
 * (e.g., a hypothetical adopter-supplied "global config" resource that returns the same data
 * regardless of which diagram is open). The instance exists at boot, so `list`/`complete` can
 * `@inject` server-scope deps directly. Bound under {@link McpResourceHandler}; the launcher
 * invokes `registerResource(server)` once per MCP session.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpResourceHandler<T = Record<string, unknown>> extends BaseMcpResourceHandler implements McpResourceHandler {
    /** Throw {@link McpToolError} for expected errors; the base wraps. */
    protected abstract createResult(params: T): MaybePromise<McpResourceContent>;

    registerResource(server: GLSPMcpServer): void {
        const annotations = this.toAnnotations();
        const config = {
            title: this.title,
            description: this.description,
            mimeType: this.mimeType,
            ...(annotations ? { annotations } : {})
        };
        if (typeof this.uri === 'string') {
            const uri = this.uri;
            server.registerResource(this.name, uri, config, async (_uri, extra) =>
                mcpRequestContext.run(extra, async () => this.toResourceResult(uri, await this.execute(() => this.createResult({} as T))))
            );
        } else {
            server.registerResource(this.name, this.buildResourceTemplate(this.uri.template), config, async (uri, params, extra) =>
                mcpRequestContext.run(extra, async () =>
                    this.toResourceResult(uri.toString(), await this.execute(() => this.createResult(toParams(params) as T)))
                )
            );
        }
    }

    /** No-op when no {@link toolAlternativeInputSchema} is declared; otherwise registers as a tool. */
    registerToolAlternative(server: GLSPMcpServer): void {
        if (!this.toolAlternativeInputSchema) {
            return;
        }
        this.doRegisterToolAlternative(server);
    }

    protected doRegisterToolAlternative(server: GLSPMcpServer): void {
        const inputSchema = this.toolAlternativeInputSchema!;
        // `.strict()` matches the tool-handler policy — see `BaseMcpToolHandler.toRegistrationConfig`
        // for the full rationale (LLM-typoed fields surface as JSON-RPC validation errors instead
        // of being silently stripped).
        server.registerTool(
            this.name,
            {
                title: this.title,
                description: this.description,
                inputSchema: inputSchema.strict(),
                outputSchema: this.toolAlternativeOutputSchema
            },
            async (params, extra) =>
                mcpRequestContext.run(extra, async () => this.toToolResult(await this.execute(() => this.createResult(params as T))))
        );
    }
}

/**
 * Diagram-scope resource base — for resources whose URI templates carry a `sessionId` (e.g.,
 * `glsp://diagrams/{sessionId}/model`).
 *
 * Unlike the server-scope base, the diagram-scope handler does not register itself with the
 * SDK. The launcher's dispatcher reads the per-diagram-type constructor list, registers a
 * single resource entry per `name`, and routes incoming reads to the matching per-GLSP-session
 * handler instance via {@link handleRead}. For `list`/`complete`, the launcher walks all open
 * GLSP sessions and aggregates each instance's slice — see {@link glspSessionScopedComplete}
 * for the cross-GLSP-session-pollution auto-guard.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpDiagramResourceHandler<
    T extends McpDiagramScopedInput = McpDiagramScopedInput
> extends BaseMcpResourceHandler {
    @inject(ClientId) protected clientId: string;
    @inject(ModelState) protected modelState: ModelState;
    @inject(McpIdAliasService) protected aliasService: McpIdAliasService;
    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    /** Throw {@link McpToolError} for expected errors; the base wraps. */
    protected abstract createResult(params: T): MaybePromise<McpResourceContent>;

    /**
     * Convenience for resource handlers that fulfil a read by initiating a `RequestAction`
     * round-trip to the client (today: `diagram-png` → `RequestExportAction`). Wraps
     * {@link requestActionOrFail} with `this.actionDispatcher` and a default label of
     * `this.name`. Pass an explicit label only to disambiguate between multiple round-trips.
     */
    protected requestAction<R extends ResponseAction>(request: RequestAction<R>, timeoutMs: number, label: string = this.name): Promise<R> {
        return requestActionOrFail(this.actionDispatcher, request, timeoutMs, label);
    }

    /** Override to opt out of registration when a runtime dependency is missing. Default: `true`. */
    canRegister(): boolean {
        return true;
    }

    /**
     * Default `list()` for the per-session-single-resource case (diagram-model, diagram-png).
     * Emits one entry resolved against the URI template, named with the handler's title and
     * the GLSP session id, described with the handler's `description`. Multi-resource
     * handlers (e.g. `element-types`, which lists once per diagram type) override.
     */
    override list(): ListResourcesResult {
        return { resources: [this.toListingEntry()] };
    }

    /**
     * Default `complete()` for templated URIs that include `{sessionId}`. Returns a single
     * completer that resolves to the current GLSP session's id. Handlers with other template
     * variables (e.g. `{diagramType}` on `element-types`) override.
     */
    override complete(): Record<string, CompleteResourceTemplateCallback> {
        if (this.uriTemplate().includes('{sessionId}')) {
            return { sessionId: async () => [this.clientId] };
        }
        return {};
    }

    /** Default per-session entry built from the handler's metadata. Override to customize. */
    protected toListingEntry(): ListResourcesResult['resources'][number] {
        const annotations = this.toAnnotations();
        return {
            uri: this.expandUriTemplate({ sessionId: this.clientId }),
            name: `${this.title ?? this.name}: ${this.clientId}`,
            description: this.description,
            mimeType: this.mimeType,
            ...(annotations ? { annotations } : {})
        };
    }

    /**
     * Public dispatch entry point invoked by {@link McpServerLauncher}'s SDK callback for
     * resource reads. The launcher passes the URI it received from the SDK plus the URI-template
     * variable values normalized into a flat record.
     */
    async handleRead(uri: string, params: T): Promise<McpResourceResult> {
        return this.toResourceResult(uri, await this.execute(() => this.createResult(params)));
    }

    /**
     * Public dispatch entry point invoked by the launcher when the resource is exposed as a
     * tool fallback (`McpServerOptions.resources === false`).
     */
    async handleAsTool(params: T): Promise<McpToolResult> {
        return this.toToolResult(await this.execute(() => this.createResult(params)));
    }

    /**
     * Wraps adopter-provided {@link complete} callbacks with the cross-GLSP-session-pollution
     * auto-guard: when a templated URI carries `{sessionId}` and the LLM has bound a specific
     * session id, completers for OTHER variables should not leak data from sessions whose ids
     * don't match. The wrapper auto-returns `[]` from a GLSP session whose id doesn't match
     * `ctx.arguments.sessionId`. Adopters write completers as if they only see their own GLSP
     * session's data — the framework enforces the guard.
     *
     * Invoked by the launcher's aggregator, not by adopters directly.
     */
    glspSessionScopedComplete(): Record<string, CompleteResourceTemplateCallback> {
        const raw = this.complete?.() ?? {};
        const myId = this.clientId;
        const isGlspSessionScoped = typeof this.uri === 'object' && this.uri.template.includes('{sessionId}');
        const wrapped: Record<string, CompleteResourceTemplateCallback> = {};
        for (const [variable, completer] of Object.entries(raw)) {
            wrapped[variable] =
                variable === 'sessionId' || !isGlspSessionScoped
                    ? completer
                    : async (value, ctx) => (ctx?.arguments?.sessionId === myId ? completer(value, ctx) : []);
        }
        return wrapped;
    }
}

/** Normalizes SDK `Variables` (each value is `string | string[]`) to a flat `Record<string, string>`. */
export function toParams(variables: Variables): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
        out[key] = Array.isArray(value) ? value[0] ?? '' : value;
    }
    return out;
}

/**
 * Multi-binding identifier for diagram-scope resource handler constructors. See
 * {@link McpDiagramToolHandlerConstructor} for the lifecycle pattern — same shape, applied to
 * resource handlers.
 */
export type McpDiagramResourceHandlerConstructor = interfaces.Newable<AbstractMcpDiagramResourceHandler<any>>;
export const McpDiagramResourceHandlerConstructor = Symbol('McpDiagramResourceHandlerConstructor');
