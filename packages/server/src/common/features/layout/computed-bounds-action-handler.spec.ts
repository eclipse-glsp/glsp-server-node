/********************************************************************************
 * Copyright (c) 2026 STMicroelectronics and others.
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
import { GGraph, GNode } from '@eclipse-glsp/graph';
import { Action, ComputedBoundsAction, DirtyStateChangeReason, LayoutOperation } from '@eclipse-glsp/protocol';
import { Container, ContainerModule } from 'inversify';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogLevel, Logger } from '../../utils/logger';
import { GModelIndex } from '../model/gmodel-index';
import { ModelState } from '../model/model-state';
import { ModelSubmissionHandler } from '../model/model-submission-handler';
import { ComputedBoundsActionHandler } from './computed-bounds-action-handler';

const NODE_ID = 'node0';
const UNKNOWN_ID = 'does-not-exist';

class CapturingLogger extends Logger {
    logLevel = LogLevel.debug;
    caller = undefined;
    readonly warnings: string[] = [];
    readonly debugMessages: string[] = [];

    info(): void {}

    warn(message: string): void {
        this.warnings.push(message);
    }

    error(): void {}

    debug(message: string): void {
        this.debugMessages.push(message);
    }
}

class StubModelSubmissionHandler extends ModelSubmissionHandler {
    submitted = false;

    override async submitModelDirectly(_reason?: DirtyStateChangeReason, _layout?: LayoutOperation): Promise<Action[]> {
        this.submitted = true;
        return [];
    }
}

function createRoot(): GGraph {
    const node = new GNode();
    node.id = NODE_ID;
    node.type = 'node';
    node.size = { width: 1, height: 1 };

    const root = new GGraph();
    root.id = 'root';
    root.type = 'graph';
    root.revision = 1;
    root.children = [node];
    return root;
}

describe('ComputedBoundsActionHandler', () => {
    let root: GGraph;
    let logger: CapturingLogger;
    let submissionHandler: StubModelSubmissionHandler;
    let handler: ComputedBoundsActionHandler;

    beforeEach(() => {
        root = createRoot();
        const index = new GModelIndex();
        index.indexRoot(root);
        logger = new CapturingLogger();
        submissionHandler = new StubModelSubmissionHandler();

        const container = new Container();
        container.load(
            new ContainerModule(bind => {
                bind(Logger).toConstantValue(logger);
                bind(ModelSubmissionHandler).toConstantValue(submissionHandler);
                bind(ModelState).toConstantValue({ root, index } as unknown as ModelState);
            })
        );
        handler = container.resolve(ComputedBoundsActionHandler);
    });

    function computedBounds(...elementIds: string[]): ComputedBoundsAction {
        return ComputedBoundsAction.create(
            elementIds.map(elementId => ({ elementId, newSize: { width: 10, height: 20 } })),
            { revision: root.revision }
        );
    }

    function nodeSize(): { width: number; height: number } | undefined {
        return (root.children[0] as GNode).size;
    }

    it('applies the reported bounds', async () => {
        await handler.execute(computedBounds(NODE_ID));

        expect(nodeSize()).toEqual({ width: 10, height: 20 });
        expect(logger.warnings).toHaveLength(0);
    });

    it('still applies the remaining bounds if one element cannot be resolved', async () => {
        await handler.execute(computedBounds(UNKNOWN_ID, NODE_ID));

        expect(nodeSize()).toEqual({ width: 10, height: 20 });
    });

    it('reports the entry it skipped, naming the element', async () => {
        await handler.execute(computedBounds(UNKNOWN_ID, NODE_ID));

        expect(logger.warnings).toHaveLength(1);
        expect(logger.warnings[0]).toContain(UNKNOWN_ID);
        expect(logger.warnings[0]).toContain('bounds');
    });

    it('still submits the model if an entry was skipped', async () => {
        await handler.execute(computedBounds(UNKNOWN_ID));

        expect(submissionHandler.submitted).toBe(true);
    });

    it('skips a route that does not describe an edge', async () => {
        const action = ComputedBoundsAction.create([], {
            revision: root.revision,
            routes: [{ elementId: NODE_ID, newRoutingPoints: [] }]
        });

        await handler.execute(action);

        expect(logger.debugMessages).toHaveLength(1);
        expect(logger.debugMessages[0]).toContain('route');
        expect(submissionHandler.submitted).toBe(true);
    });

    it('does not warn about a route the client has not finished routing', async () => {
        const action = ComputedBoundsAction.create([], {
            revision: root.revision,
            routes: [{ elementId: NODE_ID, newRoutingPoints: [] }]
        });

        await handler.execute(action);

        expect(logger.warnings).toHaveLength(0);
    });

    it('ignores an action whose revision does not match the model', async () => {
        const action = ComputedBoundsAction.create([{ elementId: NODE_ID, newSize: { width: 10, height: 20 } }], {
            revision: root.revision! + 1
        });

        await handler.execute(action);

        expect(nodeSize()).toEqual({ width: 1, height: 1 });
        expect(submissionHandler.submitted).toBe(false);
    });
});
