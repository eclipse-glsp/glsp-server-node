/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
import { GModelRoot } from '@eclipse-glsp/graph';
import { EditMode } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ClientId } from '../../di/service-identifiers';
import { GModelIndex } from './gmodel-index';
import { GModelSerializer } from './gmodel-serializer';

export const ModelState = Symbol('ModelState');

export interface ModelState {
    set<P>(key: string, property: P): void;
    setAll(properties: Record<string, unknown>): void;
    get<P>(key: string, guard?: (object: unknown) => object is P): P | undefined;
    clear(key: string): void;
    readonly root: GModelRoot;
    updateRoot(newRoot: GModelRoot): void;
    editMode: string;
    sourceUri?: string;
    clientId: string;
    readonly isReadonly: boolean;
    readonly index: GModelIndex;
}

export const SOURCE_URI_ARG = 'sourceUri';

@injectable()
export class DefaultModelState implements ModelState {
    @inject(GModelIndex)
    readonly index: GModelIndex;

    @inject(GModelSerializer)
    protected serializer: GModelSerializer;

    @inject(ClientId)
    readonly clientId: string;

    protected properties = new Map<string, any>();

    protected _root: GModelRoot;

    editMode = EditMode.EDITABLE;

    set<P>(key: string, property: P): void {
        this.properties.set(key, property);
    }

    setAll(properties: Record<string, unknown>): void {
        Object.keys(properties).forEach(key => this.properties.set(key, properties[key]));
    }

    get<P>(key: string, guard?: (object: unknown) => object is P): P | undefined {
        const result = this.properties.get(key);
        if (!guard) {
            return result as P;
        }
        return guard(result) ? result : undefined;
    }

    get sourceUri(): string | undefined {
        return this.get(SOURCE_URI_ARG);
    }

    clear(key: string): void {
        this.properties.delete(key);
    }

    get isReadonly(): boolean {
        return this.editMode === EditMode.READONLY;
    }

    public get root(): GModelRoot {
        return this._root;
    }

    protected set root(root: GModelRoot) {
        this._root = root;
    }

    updateRoot(newRoot: GModelRoot): void {
        if (!newRoot.revision && this.root) {
            newRoot.revision = this.root.revision;
        }
        this.root = newRoot;
        this.index.indexRoot(newRoot);
    }
}
