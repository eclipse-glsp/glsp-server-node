/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
    Action,
    ActionDispatcher,
    ActionHandler,
    ClientSessionManager,
    GEdge,
    GModelElementSchema,
    GNode,
    ModelState,
    ModelSubmissionHandler,
    hasStringProp
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { DiffResult, WorkflowDiff, WorkflowDiffProvider } from './workflow-diff-provider';

@injectable()
export class ComputeDiffActionHandler implements ActionHandler {
    readonly actionKinds = [ComputeDiffAction.KIND];

    @inject(WorkflowDiffProvider)
    protected diffProvider: WorkflowDiffProvider;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(ModelSubmissionHandler)
    protected modelSubmissionHandler: ModelSubmissionHandler;

    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    async execute(action: ComputeDiffAction): Promise<Action[]> {
        const diff = this.computeDiff(action.diffId);
        if (diff) {
            this.applyDiffResult(diff);
        }

        return [];
    }

    protected computeDiff(diffId: string): Required<WorkflowDiff> | undefined {
        const diff = this.diffProvider.getDiff(diffId);
        if (!diff || !diff.left || !diff.right) {
            return undefined;
        }
        if (diff.result) {
            return diff as Required<WorkflowDiff>;
        }

        const originalChildMap = new Map<string, GModelElementSchema>();
        diff.left.modelSchema.children?.forEach(child => {
            originalChildMap.set(child.id, child);
        });

        const newChildMap = new Map<string, GModelElementSchema>();
        diff.right.modelSchema.children?.forEach(child => {
            newChildMap.set(child.id, child);
        });

        const diffResult: DiffResult[] = [];

        diff.right.modelSchema.children?.forEach(newChild => {
            const originalChild = originalChildMap.get(newChild.id);
            if (!originalChild) {
                diffResult.push({ id: newChild.id, type: newChild.type, change: 'add' });
            } else if (JSON.stringify(originalChild) !== JSON.stringify(newChild)) {
                diffResult.push({ id: newChild.id, type: newChild.type, change: 'update' });
            }
        });

        diff.left.modelSchema.children?.forEach(originalChild => {
            if (!newChildMap.has(originalChild.id)) {
                diffResult.push({ id: originalChild.id, type: originalChild.type, change: 'remove' });
            }
        });

        diff.result = diffResult;

        return diff as Required<WorkflowDiff>;
    }

    protected async applyDiffResult(diff: Required<WorkflowDiff>): Promise<void> {
        const leftContainer = this.clientSessionManager.getSession(diff.left.clientId);

        if (!leftContainer) {
            return;
        }

        const leftModelState = leftContainer.container.get<ModelState>(ModelState);

        if (!leftModelState) {
            return;
        }

        diff.result.forEach(result => {
            const searchIndex = result.change === 'remove' ? leftModelState.index : this.modelState.index;

            const element = searchIndex.find(result.id, element => element.type === result.type);

            if (element instanceof GNode) {
                this.modelState.root.children.push(this.createNodeDiff(element, result));
            } else if (element instanceof GEdge) {
                this.modelState.root.children.push(this.createEdgeDiff(element, result));
            }
        });
        this.modelState.updateRoot(this.modelState.root);
        const clientUpdateActions = await this.modelSubmissionHandler.submitModelDirectly('external');
        this.actionDispatcher.dispatchAll(clientUpdateActions);
    }

    protected createNodeDiff(node: GNode, result: DiffResult): GNode {
        const builder = GNode.builder()
            .type('node:compare')
            .position(node.position)
            .size(node.size)
            .addArgs(node.args ?? {})
            .addCssClass(toCssClass(result));

        if (result.change === 'remove') {
            builder.id(node.id);
        }
        return builder.build();
    }

    protected createEdgeDiff(edge: GEdge, result: DiffResult): GEdge {
        const builder = GEdge.builder()
            .type('edge:compare')
            .sourceId(edge.sourceId)
            .targetId(edge.targetId)
            .addRoutingPoints(edge.routingPoints)
            .addArgs(edge.args ?? {})
            .addCssClass(toCssClass(result));
        if (result.change === 'remove') {
            builder.id(edge.id);
        }
        return builder.build();
    }
}

export interface ComputeDiffAction extends Action {
    kind: typeof ComputeDiffAction.KIND;
    diffId: string;
}

export namespace ComputeDiffAction {
    export const KIND = 'computeDiffAction';

    export function is(object: any): object is ComputeDiffAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'diffId');
    }

    export function create(diffId: string): ComputeDiffAction {
        return { kind: KIND, diffId };
    }
}

function toCssClass(diff: DiffResult): string {
    switch (diff.change) {
        case 'add':
            return 'diff-add';
        case 'remove':
            return 'diff-remove';
        case 'update':
            return 'diff-update';
        default:
            return '';
    }
}
