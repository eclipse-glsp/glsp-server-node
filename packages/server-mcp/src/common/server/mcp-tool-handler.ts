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

import {
    ActionDispatcher,
    ClientId,
    GModelElement,
    Logger,
    MaybePromise,
    ModelState,
    RequestAction,
    ResponseAction
} from '@eclipse-glsp/server';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import { inject, injectable, interfaces, optional } from 'inversify';
import { ZodObject, ZodRawShape } from 'zod/v4';
import { GLSPMcpServer } from './glsp-mcp-server';
import {
    McpElementsNotFoundError,
    McpReadOnlyError,
    McpStructuredContent,
    McpToolError,
    McpToolErrorCode,
    McpToolErrorCodes,
    McpToolResult,
    errorCodeFor,
    extractErrorMessage,
    requestActionOrFail,
    toolErrorResult
} from './mcp-handler-shared';
import { McpIdAliasService } from './mcp-id-alias-service';
import { ElementIdentity, McpDiagramScopedInput } from './mcp-input-schemas';
import { McpLabelProvider } from './mcp-label-provider';
import { McpRequestContext, NoopMcpRequestContext } from './mcp-request-context';

/**
 * Multi-binding key for **server-scope** tool handlers — singletons that don't target a
 * specific GLSP client session. Adopters extend {@link AbstractMcpToolHandler} and bind their
 * subclass against this symbol; the launcher invokes `registerTool(server)` on each at
 * MCP-session-init.
 *
 * Diagram-scope tools (one instance per open diagram) use the separate
 * {@link McpDiagramToolHandlerConstructor} multi-binding instead — see `mcp-session.ts` for
 * the MCP-session vs GLSP-session terminology.
 *
 * @experimental
 */
export interface McpToolHandler {
    registerTool(server: GLSPMcpServer): void;
}
export const McpToolHandler = Symbol('McpToolHandler');

/**
 * Shared infrastructure for both server- and diagram-scope tool handlers — exported so adopters
 * who want to factor common helpers across server-scope and diagram-scope tools can extend a
 * single ancestor instead of duplicating logic. Most adopters extend the more specific siblings
 * ({@link AbstractMcpToolHandler}, {@link AbstractMcpDiagramToolHandler},
 * {@link OperationMcpDiagramToolHandler}); reach for this base only when a helper is genuinely
 * scope-agnostic.
 *
 * @experimental
 */
@injectable()
export abstract class BaseMcpToolHandler {
    @inject(McpRequestContext)
    @optional()
    protected requestContext: McpRequestContext = new NoopMcpRequestContext();

    @inject(Logger) protected logger: Logger;

    /**
     * Tool identifier exposed to the MCP client. Also used to reference this tool from other
     * handlers' prompt or description text — wire via `static readonly NAME = '…'` and
     * `readonly name = ClassName.NAME` so those cross-references survive renames.
     */
    abstract readonly name: string;
    /** LLM-facing explanation surfaced in the tool catalog — clients pass this verbatim to the model. Keep concise and behavioral. */
    abstract readonly description: string;
    /** Adopter writes `z.object({ ... })`; the base passes `.shape` to the SDK. */
    abstract readonly inputSchema: ZodObject<ZodRawShape>;
    /**
     * Optional dual-emit schema. When set, pass the matching `structured` payload to
     * {@link success} so the framework forwards it as `structuredContent` alongside the
     * human-readable text. The MCP spec says clients SHOULD validate `structuredContent`
     * against the declared schema, so the two MUST stay in sync.
     */
    readonly outputSchema?: ZodObject<ZodRawShape>;
    /** Optional human-friendly display name for UIs that render a friendlier label than `name`. */
    readonly title?: string;

    // ─── Tool annotations (MCP spec: server/tools) ───────────────────────────────
    // Surfaced as flat fields rather than a nested `annotations` object so adopters can
    // override one hint with a one-line `override readonly destructiveHint = true;` instead of
    // re-declaring the whole quartet. **Untrusted** unless from a trusted server — clients
    // MUST treat these as advisory.

    /**
     * Tool does not modify its environment. Defaults to `true` here on the common base;
     * overridden to `false` on {@link OperationMcpDiagramToolHandler} since write-style tools
     * dispatch model-mutating operations.
     */
    readonly readOnlyHint: boolean = true;
    /**
     * Tool may perform destructive *updates* (irreversible deletion, data loss). Only meaningful
     * when `readOnlyHint: false`. Set explicitly on the concrete handler when it applies (e.g.
     * `delete-elements`).
     */
    readonly destructiveHint?: boolean;
    /**
     * Repeated calls with the same arguments have no additional effect. Only meaningful when
     * `readOnlyHint: false`.
     */
    readonly idempotentHint?: boolean;
    /**
     * Tool interacts with an "open world" of external entities (web search, external APIs).
     * Default in this codebase: `false` — diagram ops are bounded to the GLSP client. Set
     * `true` for tools that reach off-process.
     */
    readonly openWorldHint: boolean = false;

    /**
     * SDK-facing registration config; consumed by both the server-scope `registerTool` flow and
     * the launcher's diagram-scope dispatcher. Assembles the {@link ToolAnnotations} object from
     * the flat-field surface so adopters compose annotations via field overrides, not by
     * redeclaring the whole annotations literal.
     */
    toRegistrationConfig(): {
        title?: string;
        description: string;
        inputSchema: ZodObject<ZodRawShape>;
        outputSchema?: ZodObject<ZodRawShape>;
        annotations: ToolAnnotations;
    } {
        // `.strict()` rejects unknown keys at the SDK boundary instead of silently stripping them
        // — turns an LLM mis-typed field name into a self-correctable JSON-RPC validation error
        // rather than a misleading "no-op success".
        //
        // The `as unknown as ZodObject<ZodRawShape>` bridge is needed because `.strict()` returns
        // a `ZodObject<…, $strict>` whose `$strict` marker generic is not assignable to the
        // shape-only `ZodObject<ZodRawShape>` expected here. The SDK accepts both shapes
        // structurally, so the cast is type-only — no runtime mismatch.
        return {
            title: this.title,
            description: this.description,
            inputSchema: this.inputSchema.strict() as unknown as ZodObject<ZodRawShape>,
            outputSchema: this.outputSchema as ZodObject<ZodRawShape> | undefined,
            annotations: {
                readOnlyHint: this.readOnlyHint,
                destructiveHint: this.destructiveHint,
                idempotentHint: this.idempotentHint,
                openWorldHint: this.openWorldHint
            }
        };
    }

    protected error(message: string, code?: McpToolErrorCode): McpToolResult {
        return toolErrorResult(message, code);
    }

    /**
     * Convention: `message` is a short, referenceable summary (ids, types, counts); `structured`
     * carries the full payload. The two complement rather than duplicate — balancing token usage
     * across the heterogeneous client landscape.
     *
     * The MCP spec (2025-06-18) recommends mirroring `structuredContent` into a TextContent
     * block, but in-flight discussion is softening that — `content` and `structuredContent` are
     * increasingly model-oriented vs. machine-oriented surfaces that should be semantically
     * equivalent, not byte-identical.
     *
     * Client behavior is uneven, so summary-in-content + payload-in-structured is a deliberate
     * hedge: some clients only forward `structuredContent`, some only `content`, some forward
     * both verbatim and double the per-call context budget.
     *
     * Pass `structured` whenever {@link outputSchema} is declared (the spec says clients SHOULD
     * validate against the declared shape). Omit for plain text-only responses.
     */
    protected success(message: string, structured?: McpStructuredContent): McpToolResult {
        return { isError: false, content: [{ type: 'text', text: message }], structuredContent: structured };
    }

    /** Catches `McpToolError` (→ `isError: true` result) and unexpected errors; tags known errors via {@link errorCodeFor}. */
    protected async execute(producer: () => MaybePromise<McpToolResult>): Promise<McpToolResult> {
        try {
            return await producer();
        } catch (err: unknown) {
            const code = errorCodeFor(err);
            if (err instanceof McpToolError) {
                return this.error(err.message, code);
            }
            const message = extractErrorMessage(err);
            // Session-disposed races aren't programming errors — log at warn so they don't drown the error feed.
            if (code === McpToolErrorCodes.SessionDisposed) {
                this.logger.warn(`Session disposed mid-call in tool '${this.name}': ${message}`);
            } else {
                this.logger.error(`Unexpected error in tool '${this.name}': ${message}`, err);
            }
            return this.error(message, code);
        }
    }
}

/**
 * Server-scope tool base — for tools that don't target a specific GLSP client session
 * (e.g., listing all sessions). Bound under {@link McpToolHandler} as a server-scope singleton;
 * the launcher invokes `registerTool(server)` once per MCP session.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpToolHandler<T = Record<string, unknown>> extends BaseMcpToolHandler implements McpToolHandler {
    /** Throw {@link McpToolError} for expected, user-facing errors; the base wraps. */
    protected abstract createResult(params: T): MaybePromise<McpToolResult>;

    registerTool(server: GLSPMcpServer): void {
        server.registerTool(this.name, this.toRegistrationConfig(), async (params, extra) =>
            this.requestContext.run(extra, () => this.execute(() => this.createResult(params as T)))
        );
    }
}

/**
 * Shared per-session implementation for diagram-scope tool handlers. Adopters don't extend this
 * directly — extend {@link AbstractMcpDiagramToolHandler} (read) or {@link OperationMcpDiagramToolHandler}
 * (write). Exported only as the upper bound for the {@link McpDiagramToolHandlerConstructor}
 * multi-binding.
 *
 * `@inject(...)` fields resolve against the live `ClientSession.container` because instances are
 * created at GLSP-session-open by `McpDiagramToolHandlerRegistryInitializer`.
 *
 * Read-side handlers access `modelState.index` directly. Synchronous reads are atomic, but a
 * concurrent tool that awaits `actionDispatcher.dispatch(...)` may expose a half-committed
 * model — write-then-read tool sequences must serialize the write before the read.
 *
 * @experimental
 */
@injectable()
export abstract class BaseMcpDiagramToolHandler<T extends McpDiagramScopedInput = McpDiagramScopedInput> extends BaseMcpToolHandler {
    @inject(ClientId) protected clientId: string;
    @inject(ModelState) protected modelState: ModelState;
    @inject(McpIdAliasService) protected aliasService: McpIdAliasService;
    @inject(McpLabelProvider) protected labelProvider: McpLabelProvider;

    /** Throw {@link McpToolError} for expected errors; the base wraps. */
    protected abstract createResult(params: T): MaybePromise<McpToolResult>;

    /**
     * Public dispatch entry point invoked by {@link AbstractMcpServerLauncher}'s registered SDK
     * callback. Each sibling sets its own policy — {@link AbstractMcpDiagramToolHandler}
     * passes through; {@link OperationMcpDiagramToolHandler} enforces the readonly gate.
     * Adopters don't call this directly.
     */
    abstract handle(params: T): Promise<McpToolResult>;

    /** Override to opt out of registration when a runtime dependency is missing. Default: `true`. */
    canRegister(): boolean {
        return true;
    }

    /** Translates (alias-or-real) ids to real ids; partitions ids absent from the model into `missingIds`. */
    protected resolveIds(ids: string[]): { realIds: string[]; missingIds: string[] } {
        const realIds: string[] = [];
        const missingIds: string[] = [];
        for (const id of ids) {
            const realId = this.aliasService.lookup(id);
            if (this.modelState.index.find(realId)) {
                realIds.push(realId);
            } else {
                missingIds.push(id);
            }
        }
        return { realIds, missingIds };
    }

    /** Like {@link resolveIds} but throws {@link McpElementsNotFoundError} when any input id is absent. */
    protected resolveExistingIds(ids: string[] | undefined): string[] {
        if (!ids || ids.length === 0) {
            return [];
        }
        const { realIds, missingIds } = this.resolveIds(ids);
        if (missingIds.length > 0) {
            throw new McpElementsNotFoundError(missingIds);
        }
        return realIds;
    }

    /**
     * Resolves a list of structured inputs against the model: each input's id is looked up via the
     * alias service and the resolved element is retrieved from the index. Throws
     * {@link McpElementsNotFoundError} if any input's id is absent. The returned tuples preserve
     * caller's input/element pairing for downstream processing (e.g. type-checks per kind).
     */
    protected lookupElements<I>(inputs: I[], extractId: (input: I) => string): Array<[I, GModelElement]> {
        const found: Array<[I, GModelElement]> = [];
        const missing: string[] = [];
        for (const input of inputs) {
            const inputId = extractId(input);
            const realId = this.aliasService.lookup(inputId);
            const element = this.modelState.index.find(realId);
            if (element) {
                found.push([input, element]);
            } else {
                missing.push(inputId);
            }
        }
        if (missing.length > 0) {
            throw new McpElementsNotFoundError(missing);
        }
        return found;
    }

    /** Encodes real ids to alias ids (passthrough when {@link NullMcpIdAliasService} is bound). */
    protected encodeIds(ids: string[]): string[] {
        return ids.map(id => this.aliasService.alias(id));
    }

    /**
     * Compact identity for an element — `{ id, elementTypeId, label? }`. Mutating tools (create
     * / modify / delete) echo this so the LLM can refer to the element by label or type in
     * user-facing prose without a follow-up `query-elements` call. Returns `undefined` when
     * the element is no longer in the model (e.g. just deleted).
     */
    protected describeElement(aliasOrRealId: string): ElementIdentity | undefined {
        const realId = this.aliasService.lookup(aliasOrRealId);
        const element = this.modelState.index.find(realId);
        return element ? this.describeResolvedElement(element) : undefined;
    }

    /** Describe an already-resolved {@link GModelElement} — skips the model-lookup round-trip. */
    protected describeResolvedElement(element: GModelElement): ElementIdentity {
        const label = this.labelProvider.getLabel(element)?.text;
        // Conditional spread keeps `label` absent (not `undefined`) when the element has none —
        // matches Zod's `.optional()` semantics so the structured payload is clean.
        return { id: this.aliasService.alias(element.id), elementTypeId: element.type, ...(label !== undefined ? { label } : {}) };
    }
}

/**
 * Diagram-scope tool base for **query-style** tools that read the model without mutating it
 * (validate, get-selection, set-view, query-elements). Sibling of
 * {@link OperationMcpDiagramToolHandler} — extend that one when the tool dispatches a
 * model-mutating Operation.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpDiagramToolHandler<
    T extends McpDiagramScopedInput = McpDiagramScopedInput
> extends BaseMcpDiagramToolHandler<T> {
    handle(params: T): Promise<McpToolResult> {
        return this.execute(() => this.createResult(params));
    }
}

/**
 * Diagram-scope tool base for **operation-style** tools that mutate the model by dispatching a
 * GLSP `Operation` (or other model-mutating `Action` like `UndoAction` / `RedoAction`) on
 * behalf of the LLM — create, modify, delete, undo, redo. Sibling of
 * {@link AbstractMcpDiagramToolHandler}.
 *
 * The base bakes in two pieces beyond the read sibling:
 *  - `@inject(ActionDispatcher)`. Every adopter extending this base dispatches, so the
 *    dispatcher belongs on the base, not in per-handler boilerplate.
 *  - Throws {@link McpReadOnlyError} when `modelState.isReadonly`, surfacing a hard failure
 *    to the LLM. The MCP-side gate is necessary even though core's `OperationActionHandler`
 *    checks readonly itself: core's gate is a *soft* warning (returns a `MessageAction`, the
 *    dispatch resolves successfully and the tool body would otherwise report success while
 *    nothing changed), and `UndoRedoActionHandler` doesn't gate readonly at all.
 *
 * Parallels core's `OperationHandler` (sibling to `ActionHandler`, not a refinement) — but
 * note the role flip: core's `OperationHandler` is downstream of dispatch and only needs
 * `ModelState`; ours is upstream of dispatch (the LLM-side handler that triggers the Operation)
 * and so additionally injects `ActionDispatcher`.
 *
 * @experimental
 */
@injectable()
export abstract class OperationMcpDiagramToolHandler<
    T extends McpDiagramScopedInput = McpDiagramScopedInput
> extends BaseMcpDiagramToolHandler<T> {
    @inject(ActionDispatcher) protected actionDispatcher: ActionDispatcher;

    // Operation tools mutate the model — flip the read defaults. Concrete handlers override
    // `destructiveHint` / `idempotentHint` (one line each) where it applies; the explicit `false`
    // defaults below override the MCP spec's "true if unset" semantics so non-destructive,
    // non-idempotent writes don't trigger overzealous client-side confirmation prompts.
    override readonly readOnlyHint = false;
    override readonly destructiveHint: boolean = false;
    override readonly idempotentHint: boolean = false;

    handle(params: T): Promise<McpToolResult> {
        return this.execute(() => {
            if (this.modelState.isReadonly) {
                throw new McpReadOnlyError();
            }
            return this.createResult(params);
        });
    }

    /**
     * Convenience for tools that initiate a `RequestAction` round-trip (rather than the
     * fire-and-forget operation dispatch this base is named for) — wraps
     * {@link requestActionOrFail} with `this.actionDispatcher` and a default label of
     * `this.name`. Pass an explicit label only when the tool handles multiple distinct
     * round-trips and wants to disambiguate them in error messages.
     */
    protected requestAction<R extends ResponseAction>(request: RequestAction<R>, timeoutMs: number, label: string = this.name): Promise<R> {
        return requestActionOrFail(this.actionDispatcher, request, timeoutMs, label);
    }
}

/**
 * Multi-binding identifier for diagram-scope tool handler constructors — covers both
 * {@link AbstractMcpDiagramToolHandler} and {@link OperationMcpDiagramToolHandler}. Bound via
 * `AbstractMcpDiagramModule.configureToolHandlers`; the per-GLSP-session registry initializer
 * reads the list at session-open and resolves each constructor against the session container.
 *
 * Mirrors core's `OperationHandlerConstructor` pattern: instance fields (`readonly name = '…'`)
 * are read off `new Constructor()` at MCP-session-init for SDK catalog registration, the same
 * trick `bindOperations` uses to read `operationType`.
 */
export type McpDiagramToolHandlerConstructor = interfaces.Newable<BaseMcpDiagramToolHandler<any>>;
export const McpDiagramToolHandlerConstructor = Symbol('McpDiagramToolHandlerConstructor');
