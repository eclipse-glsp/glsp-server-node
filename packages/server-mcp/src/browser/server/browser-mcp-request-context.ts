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

import { injectable } from 'inversify';
import { McpRequestContext, McpRequestExtra } from '../../common/server/mcp-request-context';

/**
 * Browser-compatible {@link McpRequestContext} that holds one request context at a time.
 * Hosts must serialise dispatches so they don't overwrite each other (e.g. via {@link McpWorkerBridge}).
 */
@injectable()
export class BrowserMcpRequestContext implements McpRequestContext {
    protected current: McpRequestExtra | undefined;
    protected concurrencyWarned = false;

    run<R>(extra: McpRequestExtra, callback: () => R): R {
        // Warn once if an adopter forgot to serialise dispatches — silent context corruption would be hard to debug.
        if (this.current !== undefined && !this.concurrencyWarned) {
            this.concurrencyWarned = true;
            console.warn(
                'BrowserMcpRequestContext: concurrent run() detected — request contexts will overwrite each other. ' +
                    'Serialise MCP dispatches (e.g. via McpWorkerBridge or an adopter-side queue around launcher.handleRequest).'
            );
        }
        const prior = this.current;
        this.current = extra;
        let result: R;
        try {
            result = callback();
        } catch (error) {
            this.current = prior;
            throw error;
        }
        if (result instanceof Promise) {
            return result.finally(() => {
                this.current = prior;
            }) as unknown as R;
        }
        this.current = prior;
        return result;
    }

    getStore(): McpRequestExtra | undefined {
        return this.current;
    }
}
