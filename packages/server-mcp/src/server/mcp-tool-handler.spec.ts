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
import * as z from 'zod/v4';
import { McpToolResult } from './mcp-handler-shared';
import { CreateEdgesMcpToolHandler, CreateEdgesOutputSchema } from '../tools/handlers/create-edges-mcp-tool-handler';
import { CreateNodesMcpToolHandler, CreateNodesOutputSchema } from '../tools/handlers/create-nodes-mcp-tool-handler';
import { DeleteElementsMcpToolHandler, DeleteElementsOutputSchema } from '../tools/handlers/delete-elements-mcp-tool-handler';
import { GetSelectionMcpToolHandler, GetSelectionOutputSchema } from '../tools/handlers/get-selection-mcp-tool-handler';
import { LayoutMcpToolHandler, LayoutOutputSchema } from '../tools/handlers/layout-mcp-tool-handler';
import { ModifyEdgesMcpToolHandler, ModifyEdgesOutputSchema } from '../tools/handlers/modify-edges-mcp-tool-handler';
import { ModifyNodesMcpToolHandler, ModifyNodesOutputSchema } from '../tools/handlers/modify-nodes-mcp-tool-handler';
import { QueryElementsMcpToolHandler, QueryElementsOutputSchema } from '../tools/handlers/query-elements-mcp-tool-handler';
import { RedoMcpToolHandler, RedoOutputSchema } from '../tools/handlers/redo-mcp-tool-handler';
import { SaveModelMcpToolHandler, SaveModelOutputSchema } from '../tools/handlers/save-model-mcp-tool-handler';
import { SetViewMcpToolHandler, SetViewOutputSchema } from '../tools/handlers/set-view-mcp-tool-handler';
import { UndoMcpToolHandler, UndoOutputSchema } from '../tools/handlers/undo-mcp-tool-handler';
import { ValidateDiagramMcpToolHandler, ValidateDiagramOutputSchema } from '../tools/handlers/validate-diagram-mcp-tool-handler';
import { AbstractMcpToolHandler } from './mcp-tool-handler';

// ─── Framework: BaseMcpToolHandler.success(...) and toRegistrationConfig() ────────────────────

class WithoutOutputSchemaHandler extends AbstractMcpToolHandler {
    readonly name = 'no-schema';
    readonly description = 'no-schema';
    readonly inputSchema = z.object({});

    protected createResult(): McpToolResult {
        return this.success('plain');
    }

    /** Test exposure of the protected helper. `BaseMcpToolHandler` doesn't read `logger` here. */
    public testSuccess(message: string, structured?: Record<string, unknown>): McpToolResult {
        return this.success(message, structured);
    }
}

class WithOutputSchemaHandler extends AbstractMcpToolHandler {
    readonly name = 'with-schema';
    readonly description = 'with-schema';
    readonly inputSchema = z.object({});
    override readonly outputSchema = z.object({ ok: z.boolean() });

    protected createResult(): McpToolResult {
        return this.success('with', { ok: true });
    }
}

describe('Dual-emit framework', () => {
    it('success(message) without structured payload omits structuredContent', () => {
        const result = new WithoutOutputSchemaHandler().testSuccess('hi');
        expect(result.content).to.deep.equal([{ type: 'text', text: 'hi' }]);
        expect(result.structuredContent).to.equal(undefined);
        expect(result.isError).to.equal(false);
    });

    it('success(message, structured) emits structuredContent', () => {
        const result = new WithoutOutputSchemaHandler().testSuccess('hi', { count: 3, ids: ['a'] });
        expect(result.content).to.deep.equal([{ type: 'text', text: 'hi' }]);
        expect(result.structuredContent).to.deep.equal({ count: 3, ids: ['a'] });
    });

    it('toRegistrationConfig() omits outputSchema when not declared', () => {
        const config = new WithoutOutputSchemaHandler().toRegistrationConfig();
        expect(config.outputSchema).to.equal(undefined);
    });

    it('toRegistrationConfig() forwards outputSchema when declared', () => {
        const config = new WithOutputSchemaHandler().toRegistrationConfig();
        expect(config.outputSchema).to.not.equal(undefined);
        // The SDK accepts a full `ZodObject` (or its raw shape); we pass the wrapped object so
        // strict-mode rejection of unknown keys can extend uniformly to outputs.
        expect(Object.keys(config.outputSchema!.shape)).to.deep.equal(['ok']);
    });
});

// ─── Per-handler schema matrix ────────────────────────────────────────────────────────────────

/**
 * Each entry binds a handler constructor to its declared `OutputSchema` + a representative
 * structured payload. The expectations:
 *   - Constructor's `outputSchema` field matches the exported schema (same reference).
 *   - The schema accepts the representative payload (zod parse passes).
 */
const matrix: Array<{
    name: string;
    Constructor: new () => { outputSchema?: unknown };
    schema: z.ZodObject;
    sample: Record<string, unknown>;
}> = [
    {
        name: 'create-nodes',
        Constructor: CreateNodesMcpToolHandler,
        schema: CreateNodesOutputSchema,
        sample: { createdNodes: [{ id: 'n1', elementTypeId: 'node:foo' }], errors: [], warnings: [] }
    },
    {
        name: 'create-edges',
        Constructor: CreateEdgesMcpToolHandler,
        schema: CreateEdgesOutputSchema,
        sample: { createdEdges: [{ id: 'e1', elementTypeId: 'edge' }], errors: [] }
    },
    {
        name: 'modify-nodes',
        Constructor: ModifyNodesMcpToolHandler,
        schema: ModifyNodesOutputSchema,
        sample: { modifiedNodes: [{ id: 'n1', elementTypeId: 'node:foo' }], dispatchedCommands: 1, warnings: [] }
    },
    {
        name: 'modify-edges',
        Constructor: ModifyEdgesMcpToolHandler,
        schema: ModifyEdgesOutputSchema,
        sample: { modifiedEdges: [{ id: 'e1', elementTypeId: 'edge' }], dispatchedCommands: 1, errors: [] }
    },
    {
        name: 'delete-elements',
        Constructor: DeleteElementsMcpToolHandler,
        schema: DeleteElementsOutputSchema,
        sample: { deletedElements: [{ id: 'n1', elementTypeId: 'node:foo' }], deletedCount: 3 }
    },
    { name: 'undo', Constructor: UndoMcpToolHandler, schema: UndoOutputSchema, sample: { commandsUndone: 2 } },
    { name: 'redo', Constructor: RedoMcpToolHandler, schema: RedoOutputSchema, sample: { commandsRedone: 2 } },
    { name: 'layout', Constructor: LayoutMcpToolHandler, schema: LayoutOutputSchema, sample: { applied: true } },
    {
        name: 'validate-diagram',
        Constructor: ValidateDiagramMcpToolHandler,
        schema: ValidateDiagramOutputSchema,
        sample: { markers: [{ kind: 'error', label: 'bad', description: 'bad bad', elementId: 'n1' }] }
    },
    {
        name: 'get-selection',
        Constructor: GetSelectionMcpToolHandler,
        schema: GetSelectionOutputSchema,
        sample: { selectedElementIds: ['n1', 'n2'] }
    },
    {
        name: 'query-elements',
        Constructor: QueryElementsMcpToolHandler,
        schema: QueryElementsOutputSchema,
        sample: { mode: 'inspect', elements: [{ id: 'n1', type: 'node:foo', position: { x: 0, y: 0 } }] }
    },
    {
        name: 'save-model',
        Constructor: SaveModelMcpToolHandler,
        schema: SaveModelOutputSchema,
        sample: { saved: true, fileUri: 'file:///a' }
    },
    {
        name: 'set-view',
        Constructor: SetViewMcpToolHandler,
        schema: SetViewOutputSchema,
        sample: { action: 'fit-to-screen', targetIds: ['n1'] }
    }
];

describe('Tool output schemas · per-handler matrix', () => {
    matrix.forEach(({ name, Constructor, schema, sample }) => {
        describe(name, () => {
            it('declares outputSchema referencing the exported schema constant', () => {
                expect(new Constructor().outputSchema).to.equal(schema);
            });

            it('schema accepts a representative structured payload', () => {
                expect(() => schema.parse(sample)).to.not.throw();
            });
        });
    });
});
