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

// TODO entire feature depends on FEATURE_FLAG.aliasIds

export const McpIdAliasService = Symbol('McpIdAliasService');

/**
 * A Service that allows to alias IDs with an integer string. Since those are much
 * shorter and not random, it is much more efficient in terms of tokens.
 *
 * For the tools and resources this generally means that if the output contains an
 * element ID, it needs to first call `alias`. If the input contains an element ID
 * it needs to first `lookup` the real ID.
 */
export interface McpIdAliasService {
    /**
     * Maps an ID to an integer alias within a specific session.
     * If the ID has been seen before in this session, it returns the existing alias.
     */
    alias(sessionId: string, id: string): string;
    /**
     * Retrieves the original ID associated with an alias for a specific session.
     * @throws Error if the alias does not exist.
     */
    lookup(sessionId: string, alias: string): string;
}

@injectable()
export class DefaultMcpIdAliasService implements McpIdAliasService {
    // Map<sessionId, Map<uuid, alias>>
    protected idAliasMap = new Map<string, Map<string, string>>();
    // Map<sessionId, Map<alias, uuid>>
    protected aliasIdMap = new Map<string, Map<string, string>>();

    protected counter = 0;

    alias(sessionId: string, uuid: string): string {
        let idToAlias = this.idAliasMap.get(sessionId);
        let aliasToId = this.aliasIdMap.get(sessionId);

        if (!idToAlias || !aliasToId) {
            idToAlias = new Map();
            aliasToId = new Map();
            this.idAliasMap.set(sessionId, idToAlias);
            this.aliasIdMap.set(sessionId, aliasToId);
        }

        const existingAlias = idToAlias.get(uuid);
        if (existingAlias) {
            return existingAlias;
        }

        const newAlias = (++this.counter).toString();

        idToAlias.set(uuid, newAlias);
        aliasToId.set(newAlias, uuid);

        return newAlias;
    }

    lookup(sessionId: string, alias: string): string {
        const aliasToUuid = this.aliasIdMap.get(sessionId);
        const uuid = aliasToUuid?.get(alias);

        if (!uuid) {
            throw new Error(`Mapping not found for alias "${alias}" in session "${sessionId}"`);
        }

        return uuid;
    }
}

@injectable()
export class DummyMcpIdAliasService implements McpIdAliasService {
    alias(sessionId: string, id: string): string {
        return id;
    }

    lookup(sessionId: string, alias: string): string {
        return alias;
    }
}
