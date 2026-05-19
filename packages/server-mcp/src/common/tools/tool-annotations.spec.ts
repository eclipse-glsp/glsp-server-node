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

import { expect } from 'chai';
import { interfaces } from 'inversify';
import { SetViewMcpToolHandler } from './handlers/set-view-mcp-tool-handler';
import { CreateEdgesMcpToolHandler } from './handlers/create-edges-mcp-tool-handler';
import { CreateNodesMcpToolHandler } from './handlers/create-nodes-mcp-tool-handler';
import { DeleteElementsMcpToolHandler } from './handlers/delete-elements-mcp-tool-handler';
import { QueryElementsMcpToolHandler } from './handlers/query-elements-mcp-tool-handler';
import { GetSelectionMcpToolHandler } from './handlers/get-selection-mcp-tool-handler';
import { ModifyEdgesMcpToolHandler } from './handlers/modify-edges-mcp-tool-handler';
import { ModifyNodesMcpToolHandler } from './handlers/modify-nodes-mcp-tool-handler';
import { RedoMcpToolHandler } from './handlers/redo-mcp-tool-handler';
import { SaveModelMcpToolHandler } from './handlers/save-model-mcp-tool-handler';
import { UndoMcpToolHandler } from './handlers/undo-mcp-tool-handler';
import { ValidateDiagramMcpToolHandler } from './handlers/validate-diagram-mcp-tool-handler';

interface AnnotatedHandler {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}

/**
 * Reads the four annotation hint fields off a freshly `new`-ed handler. Mirrors how the launcher
 * reads metadata via `new Constructor()` at MCP-session-init (see
 * `mcp-server-launcher.ts#registerDiagramScopeTools`); no DI wiring needed because the fields
 * are plain class properties with literal initializers.
 */
function hintsOf(Constructor: interfaces.Newable<AnnotatedHandler>): AnnotatedHandler {
    const handler = new Constructor();
    return {
        readOnlyHint: handler.readOnlyHint,
        destructiveHint: handler.destructiveHint,
        idempotentHint: handler.idempotentHint,
        openWorldHint: handler.openWorldHint
    };
}

const READ_DEFAULT: AnnotatedHandler = {
    readOnlyHint: true,
    destructiveHint: undefined,
    idempotentHint: undefined,
    openWorldHint: false
};

const OPERATION_DEFAULT: AnnotatedHandler = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
};

describe('Tool annotations · per-handler matrix', () => {
    describe('read-style handlers (inherit base default)', () => {
        const readStyleHandlers: Array<[string, interfaces.Newable<AnnotatedHandler>]> = [
            ['query-elements', QueryElementsMcpToolHandler],
            ['get-selection', GetSelectionMcpToolHandler],
            ['validate-diagram', ValidateDiagramMcpToolHandler]
        ];
        readStyleHandlers.forEach(([name, Constructor]) => {
            it(`${name} matches the read-style default`, () => {
                expect(hintsOf(Constructor)).to.deep.equal(READ_DEFAULT);
            });
        });
    });

    describe('operation-style handlers (override to write defaults)', () => {
        const operationStyleHandlers: Array<[string, interfaces.Newable<AnnotatedHandler>]> = [
            ['create-nodes', CreateNodesMcpToolHandler],
            ['create-edges', CreateEdgesMcpToolHandler],
            ['modify-nodes', ModifyNodesMcpToolHandler],
            ['modify-edges', ModifyEdgesMcpToolHandler],
            ['undo', UndoMcpToolHandler],
            ['redo', RedoMcpToolHandler]
        ];
        operationStyleHandlers.forEach(([name, Constructor]) => {
            it(`${name} matches the operation-style default`, () => {
                expect(hintsOf(Constructor)).to.deep.equal(OPERATION_DEFAULT);
            });
        });
    });

    describe('per-handler overrides', () => {
        it('delete-elements is destructiveHint:true (single-flag override)', () => {
            expect(hintsOf(DeleteElementsMcpToolHandler)).to.deep.equal({ ...OPERATION_DEFAULT, destructiveHint: true });
        });

        it('save-model is NOT readOnly (writes to disk) and NOT destructive (creative)', () => {
            // Spec: `readOnlyHint` means "does not modify its environment" — disk IS environment.
            // `destructiveHint` is for irreversible deletion / data loss; save is creative.
            // Save-model extends the read base (not the operation base) because it doesn't
            // dispatch a model-mutating Operation, but we override the flat fields explicitly.
            expect(hintsOf(SaveModelMcpToolHandler)).to.deep.equal({
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false
            });
        });

        it('set-view drops the read-only claim (viewport IS environment)', () => {
            // Inherits from the read base, which would claim readOnlyHint:true. Override flips
            // it: dispatching a viewport action mutates client-side state, even though no
            // diagram model bytes change.
            expect(hintsOf(SetViewMcpToolHandler)).to.deep.equal({
                readOnlyHint: false,
                destructiveHint: undefined,
                idempotentHint: undefined,
                openWorldHint: false
            });
        });
    });

    describe('toRegistrationConfig() assembles the annotations object the SDK expects', () => {
        it('aggregates the flat fields into the SDK ToolAnnotations shape', () => {
            const config = new DeleteElementsMcpToolHandler().toRegistrationConfig();
            expect(config.annotations).to.deep.equal({
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false
            });
        });
    });
});
