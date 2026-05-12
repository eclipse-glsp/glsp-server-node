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

import { ClientId, Logger, MaybePromise, ModelState } from '@eclipse-glsp/server';
import { inject, injectable, interfaces } from 'inversify';
import { ZodObject, ZodRawShape } from 'zod/v4';
import { GLSPMcpServer } from './glsp-mcp-server';
import { McpPromptResult, McpToolError, extractErrorMessage } from './mcp-handler-shared';
import { McpIdAliasService } from './mcp-id-alias-service';
import { McpDiagramScopedInput } from './mcp-input-schemas';
import { mcpRequestContext } from './mcp-request-context';

/**
 * Multi-binding key for **server-scope** prompt handlers — singletons that don't target a
 * specific GLSP client session. Diagram-scope prompts (one instance per open diagram) use the
 * separate {@link McpDiagramPromptHandlerConstructor} multi-binding instead.
 *
 * Prompts are LLM-facing message templates the AI client may invoke. No prompts ship by default;
 * the surface exists for adopters.
 *
 * @experimental
 */
export interface McpPromptHandler {
    /** Prompt identifier exposed to the MCP client; matches the abstract base's field. */
    readonly name: string;
    registerPrompt(server: GLSPMcpServer): void;
    /** Tool names this prompt's text references via `${OtherHandler.NAME}`; default: empty. */
    referencedToolNames(): string[];
}
export const McpPromptHandler = Symbol('McpPromptHandler');

/** Shared infrastructure for both server- and diagram-scope prompt handlers. */
@injectable()
abstract class BaseMcpPromptHandler {
    @inject(Logger) protected logger: Logger;

    /**
     * Prompt identifier exposed to the MCP client. Also used to reference this prompt from
     * other handlers' prompt or description text — wire via `static readonly NAME = '…'` and
     * `readonly name = ClassName.NAME` so those cross-references survive renames.
     */
    abstract readonly name: string;
    /** LLM-facing explanation surfaced in the prompt catalog. Keep concise — clients pass this verbatim to the model. */
    abstract readonly description: string;
    /** Adopter writes `z.object({ ... })`; the base passes `.shape` to the SDK. */
    abstract readonly argsSchema: ZodObject<ZodRawShape>;
    /** Optional human-friendly display name for UIs that render a friendlier label than `name`. */
    readonly title?: string;

    /** SDK-facing registration config; consumed by both registration paths. */
    toRegistrationConfig(): { title?: string; description: string; argsSchema: ZodRawShape } {
        return { title: this.title, description: this.description, argsSchema: this.argsSchema.shape };
    }

    /**
     * Optional list of tool names this prompt's text refers to via `${OtherHandler.NAME}`
     * substitutions. Default: empty. Override in concrete subclasses to declare references so
     * the launcher can warn at registration time when an adopter unbinds a referenced tool —
     * the prompt would otherwise still register and silently produce text pointing at a tool
     * that no longer exists. Pure declarative metadata; never invoked at request time.
     */
    referencedToolNames(): string[] {
        return [];
    }

    /**
     * Catches `McpToolError` (→ surfaced as a `user`-role assistant message) and unexpected
     * errors (→ logged + extracted message). Errors map to a single text-content message so
     * the LLM sees the failure in the prompt response.
     */
    protected async execute(producer: () => MaybePromise<McpPromptResult>): Promise<McpPromptResult> {
        try {
            return await producer();
        } catch (err: unknown) {
            if (err instanceof McpToolError) {
                return this.errorResult(err.message);
            }
            const message = extractErrorMessage(err);
            this.logger.error(`Unexpected error in prompt '${this.name}': ${message}`, err);
            return this.errorResult(message);
        }
    }

    protected errorResult(message: string): McpPromptResult {
        return { messages: [{ role: 'user', content: { type: 'text', text: message } }] };
    }
}

/**
 * Server-scope prompt base — for prompts that don't target a specific GLSP client session
 * (e.g., a prompt that summarizes the system's state). Bound under {@link McpPromptHandler};
 * the launcher invokes `registerPrompt(server)` once per MCP session.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpPromptHandler<T = Record<string, unknown>> extends BaseMcpPromptHandler implements McpPromptHandler {
    /** Throw {@link McpToolError} for expected errors; the base wraps. */
    protected abstract createResult(args: T): MaybePromise<McpPromptResult>;

    registerPrompt(server: GLSPMcpServer): void {
        server.registerPrompt(this.name, this.toRegistrationConfig(), async (args, extra) =>
            mcpRequestContext.run(extra, () => this.execute(() => this.createResult(args as T)))
        );
    }
}

/**
 * Diagram-scope prompt base — for prompts whose argument schema carries a `sessionId`
 * (e.g., a `describe-diagram` prompt for one open diagram).
 *
 * The launcher's dispatcher resolves `args.sessionId` to the right GLSP session and invokes
 * {@link handle} on this session's per-instance handler. From the handler's perspective the
 * session is implicit — `this.clientId`, `this.modelState`, `this.aliasService` (and any
 * adopter `@inject(...)` fields) all resolve to that GLSP session's container.
 *
 * @experimental
 */
@injectable()
export abstract class AbstractMcpDiagramPromptHandler<
    T extends McpDiagramScopedInput = McpDiagramScopedInput
> extends BaseMcpPromptHandler {
    @inject(ClientId) protected clientId: string;
    @inject(ModelState) protected modelState: ModelState;
    @inject(McpIdAliasService) protected aliasService: McpIdAliasService;

    /** Throw {@link McpToolError} for expected errors; the base wraps. */
    protected abstract createResult(args: T): MaybePromise<McpPromptResult>;

    /**
     * Public dispatch entry point invoked by {@link McpServerLauncher}'s SDK callback.
     */
    handle(args: T): Promise<McpPromptResult> {
        return this.execute(() => this.createResult(args));
    }
}

/**
 * Multi-binding identifier for diagram-scope prompt handler constructors. See
 * {@link McpDiagramToolHandlerConstructor} for the lifecycle pattern — same shape, applied to
 * prompt handlers.
 */
export type McpDiagramPromptHandlerConstructor = interfaces.Newable<AbstractMcpDiagramPromptHandler<any>>;
export const McpDiagramPromptHandlerConstructor = Symbol('McpDiagramPromptHandlerConstructor');
