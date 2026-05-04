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

import { injectable } from 'inversify';

export const McpIdAliasService = Symbol('McpIdAliasService');

/**
 * Maps real GLSP element ids to a shorter, more LLM-friendly form on the wire. Tool/resource
 * handlers `alias` real ids before emitting them and `lookup` incoming aliases before passing
 * them to the model.
 *
 * Bound per GLSP client session — alias state is shared across MCP clients connected to the
 * same GLSP session (id↔alias round-tripping must be consistent across clients). Adopters
 * who want raw ids on the wire bind {@link NullMcpIdAliasService} via
 * {@link DefaultMcpDiagramModule.bindIdAliasService}.
 *
 * @experimental
 */
export interface McpIdAliasService {
    /**
     * Returns the alias for the given real id, allocating one on first call. Stable across
     * subsequent calls within the same session.
     */
    alias(realId: string): string;
    /**
     * Resolves an alias back to its real id. Falls back to the input verbatim when no mapping
     * exists, so callers can pass either an alias or a real id without branching: aliased ids
     * round-trip; real ids (manual user input, copy-paste, ids surfaced from earlier
     * server-side state) pass through. Downstream existence checks
     * (`modelState.index.find`, the operation handler) decide validity.
     */
    lookup(aliasOrRealId: string): string;
}

/**
 * Default {@link McpIdAliasService} — sequential integer aliases per session.
 *
 * Collision avoidance: every real id passed to {@link alias} is also recorded in a known-real
 * set. When minting, candidate alias strings that collide with a known real id are skipped, so
 * a model element whose actual id is e.g. `"1"` cannot be shadowed by an alias mapped to a
 * different real id. This is conditional on the existing convention that every real id
 * surfaced to the LLM flows through `alias()` at least once before the LLM can refer to it —
 * adopter-written handlers that bypass `alias()` re-open the corner case.
 */
@injectable()
export class DefaultMcpIdAliasService implements McpIdAliasService {
    protected idToAlias = new Map<string, string>();
    protected aliasToId = new Map<string, string>();
    protected realIds = new Set<string>();
    protected counter = 1;

    alias(realId: string): string {
        this.realIds.add(realId);
        const existingAlias = this.idToAlias.get(realId);
        if (existingAlias) {
            return existingAlias;
        }

        let candidate = this.counter.toString();
        while (this.realIds.has(candidate)) {
            this.counter += 1;
            candidate = this.counter.toString();
        }
        this.counter += 1;

        this.idToAlias.set(realId, candidate);
        this.aliasToId.set(candidate, realId);

        return candidate;
    }

    lookup(aliasOrRealId: string): string {
        return this.aliasToId.get(aliasOrRealId) ?? aliasOrRealId;
    }
}

/**
 * Null-object {@link McpIdAliasService} — passes ids through unchanged. Bind this in
 * {@link DefaultMcpDiagramModule.bindIdAliasService} to expose raw GLSP ids on the wire.
 */
@injectable()
export class NullMcpIdAliasService implements McpIdAliasService {
    alias(realId: string): string {
        return realId;
    }

    lookup(aliasOrRealId: string): string {
        return aliasOrRealId;
    }
}
