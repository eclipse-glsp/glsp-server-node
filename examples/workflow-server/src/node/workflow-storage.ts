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
    Args,
    ClientId,
    ClientSessionManager,
    GModelRootSchema,
    GModelStorage,
    RequestModelAction,
    isGModelElementSchema
} from '@eclipse-glsp/server/node';
import { inject, injectable } from 'inversify';
import { ComputeDiffAction } from '../common/compute-diff-action-handler';
import { WorkflowDiffProvider } from '../common/workflow-diff-provider';

export interface DiffArgs extends Args {
    diffId: string;
    diffSide: 'left' | 'right';
    diffContent: string;
}

export namespace DiffArgs {
    export function is(value?: Args): value is DiffArgs {
        return value?.diffId !== undefined && value?.diffSide !== undefined && value?.diffContent !== undefined;
    }
}

@injectable()
export class WorkflowStorage extends GModelStorage {
    @inject(WorkflowDiffProvider)
    protected diffProvider: WorkflowDiffProvider;
    @inject(ClientId)
    protected readonly clientId: string;

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    override async loadSourceModel(action: RequestModelAction): Promise<void> {
        const options = action.options;
        if (!DiffArgs.is(options)) {
            return super.loadSourceModel(action);
        }

        const result = this.loadDiffModel(options);

        return result;
    }

    protected async loadDiffModel(args: DiffArgs): Promise<void> {
        const rootSchema = this.loadFromString(args.diffContent);
        if (!rootSchema) {
            return;
        }
        const root = this.modelSerializer.createRoot(rootSchema);
        this.modelState.editMode = 'readonly';
        this.modelState.updateRoot(root);
        this.modelState.root.cssClasses.push('diff');
        const diff = this.diffProvider.createDiff(args.diffId, {
            side: args.diffSide,
            data: { clientId: this.clientId, modelSchema: rootSchema }
        });
        if (diff?.left && diff?.right) {
            this.clientSessionManager
                .getSession(diff?.right?.clientId)
                ?.actionDispatcher.dispatchAfterNextUpdate(ComputeDiffAction.create(diff.diffId));
        }
    }

    protected loadFromString(content?: string): GModelRootSchema | undefined {
        if (!content) {
            return undefined;
        }

        const model = JSON.parse(content);
        if (!isGModelElementSchema(model)) {
            throw new Error('The loaded root object is not of the expected type!');
        }

        return model;
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
