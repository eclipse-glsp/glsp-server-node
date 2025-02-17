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
import { ClientSession, ClientSessionListener, ClientSessionManager, GModelRootSchema } from '@eclipse-glsp/server';
import { inject, injectable, postConstruct } from 'inversify';

@injectable()
export class WorkflowDiffProvider implements ClientSessionListener {
    priority?: number | undefined;
    protected diffMap: Map<string, WorkflowDiff> = new Map();

    @inject(ClientSessionManager)
    protected clientSessionManager: ClientSessionManager;

    @postConstruct()
    protected init(): void {
        this.clientSessionManager.addListener(this);
    }

    createDiff(diffId: string, side: { side: 'left' | 'right'; data: DiffData }): WorkflowDiff | undefined {
        let existingDiff = this.getDiff(diffId);
        if (!existingDiff) {
            existingDiff = { diffId };
            this.diffMap.set(diffId, existingDiff);
        }
        if (side.side === 'left' && !existingDiff.left) {
            existingDiff.left = side.data;
            return existingDiff;
        }
        if (side.side === 'right' && !existingDiff.right) {
            existingDiff.right = side.data;
            return existingDiff;
        }
        return undefined;
    }

    hasDiff(diffId: string): boolean {
        return this.diffMap.has(diffId);
    }

    getDiff(diffId: string): WorkflowDiff | undefined {
        return this.diffMap.get(diffId);
    }

    getDiffByClientId(clientId: string): WorkflowDiff | undefined {
        return Array.from(this.diffMap.values()).find(diff => diff.left?.clientId === clientId || diff.right?.clientId === clientId);
    }

    sessionDisposed(clientSession: ClientSession): void {
        const toRemove = Array.from(this.diffMap.values()).find(
            diff => diff.left?.clientId === clientSession.id || diff.right?.clientId === clientSession.id
        );
        if (toRemove) {
            this.diffMap.delete(toRemove.diffId);
        }
    }
}

export interface WorkflowDiff {
    diffId: string;
    left?: DiffData;
    right?: DiffData;
    result?: DiffResult[];
}

export interface DiffData {
    clientId: string;
    modelSchema: GModelRootSchema;
}

export interface DiffResult {
    id: string;
    type: string;
    change: 'add' | 'remove' | 'update';
}
