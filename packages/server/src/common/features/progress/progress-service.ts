/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { EndProgressAction, StartProgressAction, UpdateProgressAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid';
import { ActionDispatcher } from '../../actions/action-dispatcher';

export const ProgressService = Symbol('ProgressService');

/**
 * Service for starting and monitoring progress reporting to the client.
 */
export interface ProgressService {
    /**
     * Start a progress reporting.
     * @param title The title shown in the UI for the progress reporting.
     * @param options Additional optional options for the progress reporting.
     * @returns a monitor to update and end the progress reporting later.
     */
    start(title: string, options?: ProgressOptions): ProgressMonitor;
}

/**
 * Optional progress reporting options.
 */
export interface ProgressOptions {
    /** A message shown in the UI. */
    message?: string;
    /* The percentage (value range: 0 to 100) to show in the progress reporting. */
    percentage?: number;
}

/**
 * The monitor of a progress reporting, which can be used to update and end the reporting.
 */
export interface ProgressMonitor {
    /**
     * Updates an ongoing progress reporting.
     * @param options Updated message and/or percentage (value range: 0 to 100).
     */
    update(options: { message?: string; percentage?: number }): void;
    /**
     * Ends an ongoing progress reporting.
     */
    end(): void;
}

@injectable()
export class DefaultProgressService implements ProgressService {
    @inject(ActionDispatcher)
    protected actionDispatcher: ActionDispatcher;

    start(title: string, options?: ProgressOptions): ProgressMonitor {
        const progressId = uuid.v4();
        this.actionDispatcher.dispatch(StartProgressAction.create({ progressId, title, ...options }));
        return {
            update: updateOptions => this.actionDispatcher.dispatch(UpdateProgressAction.create(progressId, updateOptions)),
            end: () => this.actionDispatcher.dispatch(EndProgressAction.create(progressId))
        };
    }
}
