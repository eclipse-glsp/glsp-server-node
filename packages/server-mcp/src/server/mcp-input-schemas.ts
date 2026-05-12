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

import * as z from 'zod/v4';

/**
 * Common Zod input-schema fragments shared across MCP tool / resource / prompt handlers.
 * Adopters compose these via `z.object({ ... })` or `McpDiagramScopedInputSchema.extend(...)`
 * — Zod's modifiers (`.describe`, `.optional`, `.min`, ...) return new schemas without mutating
 * the exports, so the shared fragments can be safely adapted at the call site.
 *
 * @example
 * ```ts
 * import { McpDiagramScopedInputSchema, elementIds } from '@eclipse-glsp/server-mcp';
 *
 * // Use as-is — the tool's `description` field already conveys the action context:
 * const inputSchema = McpDiagramScopedInputSchema.extend({ elementIds });
 *
 * // Override `describe` only when there's genuinely new info (defaults, conditional applicability):
 * const inputSchema = McpDiagramScopedInputSchema.extend({
 *     elementIds: elementIds.optional().describe('If not provided, validates entire model.')
 * });
 * ```
 */

/** GLSP client session id (open diagram). Resolved by the launcher dispatcher via `ClientSessionManager`. */
export const sessionId = z.string().describe('GLSP client session id (open diagram).');

/** Single element id — alias or real; handlers translate via `resolveIds` on the diagram base. */
export const elementId = z.string();

/** One or more element ids. Empty arrays are rejected. */
export const elementIds = z.array(z.string()).min(1);

/** Cartesian position used by node-creation / -modification tools. */
export const position = z
    .object({
        x: z.number().describe('X coordinate in diagram space'),
        y: z.number().describe('Y coordinate in diagram space')
    })
    .strict();

/**
 * Base schema for diagram-scope tool / prompt / resource-tool-alternative input. Adopter
 * schemas extend this via {@link z.ZodObject.extend} and add their tool-specific fields.
 */
export const McpDiagramScopedInputSchema = z.object({ sessionId });

/**
 * Compact identity echoed by mutating tools (create / modify / delete) so the LLM has enough
 * context to refer to the element by label or type in user-facing prose without a follow-up
 * `query-elements`. The `id` is the alias.
 */
export const ElementIdentitySchema = z.object({
    id: z.string().describe('Aliased element id.'),
    elementTypeId: z.string().describe('Element type id (e.g. `node:foo`, `edge`).'),
    label: z.string().optional().describe('Primary label text, when the element has one.')
});

/** Inferred shape of {@link ElementIdentitySchema} — see its docstring for usage. */
export type ElementIdentity = z.infer<typeof ElementIdentitySchema>;

/**
 * Inferred shape of {@link McpDiagramScopedInputSchema} — `{ sessionId: string }`. Any
 * adopter input schema that extends `McpDiagramScopedInputSchema` infers a type structurally
 * assignable to this; used as the upper bound on diagram-scope handler generics
 * (`<T extends McpDiagramScopedInput = McpDiagramScopedInput>`).
 */
export type McpDiagramScopedInput = z.infer<typeof McpDiagramScopedInputSchema>;
