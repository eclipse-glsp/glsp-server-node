/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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

/**
 * Interface for objects that can or need to be disposed properly.
 */
export interface IDisposable {
    /**
     * Disposes the current object by releasing any underlying resources or cleaning up any registrations.
     */
    dispose(): void;

    /**
     * Returns true if this object is considered disposed.
     */
    readonly isDisposed: boolean;
}

export function isIDisposable(object: any): object is IDisposable {
    return (
        object !== undefined &&
        typeof object === 'object' &&
        'dispose' in object &&
        typeof object['dispose'] === 'function' &&
        'isDisposed' in object &&
        typeof object['isDisposed'] === 'boolean'
    );
}

@injectable()
export class Disposable implements IDisposable {
    private disposed = false;

    dispose(): void {
        if (!this.disposed) {
            this.doDispose();
            this.disposed = true;
        }
    }

    protected doDispose(): void {
        // do nothing.
    }

    get isDisposed(): boolean {
        return this.disposed;
    }

    static create(runnable: () => void): IDisposable {
        const disposable = new Disposable();
        disposable['doDispose'] = runnable;
        return disposable;
    }
}
