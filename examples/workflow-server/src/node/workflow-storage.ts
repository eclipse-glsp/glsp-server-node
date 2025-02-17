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
    ActionDispatcher,
    ClientId,
    ClientSessionManager,
    GModelStorage,
    GNode,
    ModelState,
    RequestModelAction,
    SetEditModeAction,
    isGModelElementSchema
} from '@eclipse-glsp/server/node';
import { inject, injectable } from 'inversify';
import { DiffResult, WorkflowDiff, WorkflowDiffProvider } from '../common/workflow-diff-provider';
import { getQueryParams } from './query-util';

@injectable()
export class WorkflowStorage extends GModelStorage {
    @inject(WorkflowDiffProvider)
    protected diffProvider: WorkflowDiffProvider;
    @inject(ClientId)
    protected readonly clientId: string;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    @inject(ActionDispatcher)
    protected readonly actionDispatcher: ActionDispatcher;

    override async loadSourceModel(action: RequestModelAction): Promise<void> {
        const sourceUri = this.getSourceUri(action);
        const rootSchema = this.loadFromFile(sourceUri, isGModelElementSchema);
        const root = this.modelSerializer.createRoot(rootSchema);
        this.modelState.updateRoot(root);
        const diffParams = getQueryParams<DiffParams>(sourceUri, DiffParams.is);
        if (diffParams) {
            this.modelState.editMode = 'readonly';
            this.actionDispatcher.dispatch(SetEditModeAction.create('readonly'));
            const diff = this.diffProvider.createDiff(diffParams.diffId, {
                side: diffParams.side,
                data: { clientId: this.clientId, modelSchema: rootSchema }
            });
            if (diff?.left && diff?.right) {
                const diff = this.diffProvider.computeDiff(diffParams.diffId);
                if (diff) {
                    this.applyDiffResult(diff);
                }
                this.modelState.index.indexRoot(this.modelState.root);
            }
        }
    }

    protected applyDiffResult(diff: Required<WorkflowDiff>): void {
        const leftModelState = this.clientSessionManager.getSession(diff.left.clientId)?.container.get<ModelState>(ModelState);
        const rightModelState = this.clientSessionManager.getSession(diff.right.clientId)?.container.get<ModelState>(ModelState);
        if (!leftModelState || !rightModelState) {
            return;
        }
        leftModelState.root.cssClasses.push('diff');
        rightModelState.root.cssClasses.push('diff');

        diff.result.forEach(result => {
            const modelState = result.change === 'remove' ? leftModelState : rightModelState;

            const element = modelState.index.find(result.id, element => element.type === result.type);

            if (element instanceof GNode) {
                modelState.root.children.push(this.createNodeDiff(element, result));
            }
        });
    }

    protected createNodeDiff(node: GNode, result: DiffResult): GNode {
        return GNode.builder()
            .type('node:compare')
            .position(node.position)
            .size(node.size)
            .addArgs(node.args ?? {})
            .addCssClass(toCssClass(result))
            .build();
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

export interface DiffParams {
    mode: 'diff';
    side: 'left' | 'right';
    diffId: string;
}

export namespace DiffParams {
    export function is(value: any): value is DiffParams {
        return value.mode === 'diff' && (value.side === 'left' || value.side === 'right') && typeof value.diffId === 'string';
    }
}
