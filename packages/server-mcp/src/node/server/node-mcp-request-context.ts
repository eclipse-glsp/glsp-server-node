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

import { AsyncLocalStorage } from 'async_hooks';
import { injectable } from 'inversify';
import { McpRequestContext, McpRequestExtra } from '../../common/server/mcp-request-context';

/** {@link McpRequestContext} backed by native `AsyncLocalStorage`; frame survives across `await`. */
@injectable()
export class NodeMcpRequestContext implements McpRequestContext {
    protected storage = new AsyncLocalStorage<McpRequestExtra>();

    run<R>(extra: McpRequestExtra, callback: () => R): R {
        return this.storage.run(extra, callback);
    }

    getStore(): McpRequestExtra | undefined {
        return this.storage.getStore();
    }
}
