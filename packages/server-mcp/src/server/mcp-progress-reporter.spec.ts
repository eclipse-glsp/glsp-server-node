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

import { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { expect } from 'chai';
import { McpProgressReporter } from './mcp-progress-reporter';
import { McpRequestExtra, mcpRequestContext } from './mcp-request-context';

function buildExtra(progressToken?: string | number): { extra: McpRequestExtra; sent: ServerNotification[] } {
    const sent: ServerNotification[] = [];
    const extra = {
        sendNotification: async (n: ServerNotification) => {
            sent.push(n);
        },
        _meta: progressToken === undefined ? undefined : { progressToken }
    } as unknown as McpRequestExtra;
    return { extra, sent };
}

describe('McpProgressReporter', () => {
    it('no-ops inside a request that has no progressToken (client did not opt in)', async () => {
        const reporter = new McpProgressReporter();
        const { extra, sent } = buildExtra(undefined);

        await mcpRequestContext.run(extra, async () => {
            await reporter.emit({ progress: 0, message: 'starting' });
        });

        expect(sent).to.have.lengthOf(0);
    });

    it('emits notifications/progress when the request carries a progressToken', async () => {
        const reporter = new McpProgressReporter();
        const { extra, sent } = buildExtra('tok-42');

        await mcpRequestContext.run(extra, async () => {
            await reporter.emit({ progress: 0, message: 'starting' });
            await reporter.emit({ progress: 1, total: 3, message: 'step 1/3' });
        });

        expect(sent).to.have.lengthOf(2);
        expect(sent[0]).to.deep.equal({
            method: 'notifications/progress',
            params: { progressToken: 'tok-42', progress: 0, message: 'starting' }
        });
        expect(sent[1]).to.deep.equal({
            method: 'notifications/progress',
            params: { progressToken: 'tok-42', progress: 1, total: 3, message: 'step 1/3' }
        });
    });

    it('accepts numeric progress tokens', async () => {
        const reporter = new McpProgressReporter();
        const { extra, sent } = buildExtra(7);

        await mcpRequestContext.run(extra, async () => {
            await reporter.emit({ progress: 0 });
        });

        expect(sent).to.have.lengthOf(1);
        expect(sent[0].params).to.deep.equal({ progressToken: 7, progress: 0 });
    });

    it('swallows transport failures so a broken send never breaks the producing tool', async () => {
        const reporter = new McpProgressReporter();
        const failingExtra = {
            sendNotification: async () => {
                throw new Error('transport closed');
            },
            _meta: { progressToken: 'tok-1' }
        } as unknown as McpRequestExtra;

        await mcpRequestContext.run(failingExtra, async () => {
            // Must complete without throwing. If we re-threw, every PNG export would hard-fail
            // when the client's SSE stream blipped — the opposite of progress reporting being
            // a UX nicety.
            await reporter.emit({ progress: 0, message: 'starting' });
        });
    });
});
