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

import { McpServer, RegisteredResource } from '@modelcontextprotocol/sdk/server/mcp.js';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as z from 'zod/v4';
import { DefaultGLSPMcpServer } from './glsp-mcp-server';

describe('DefaultGLSPMcpServer', () => {
    function makeServer(): { wrapper: DefaultGLSPMcpServer; sdk: McpServer } {
        const sdk = new McpServer({ name: 'test', version: '1.0.0' }, { capabilities: {} });
        const wrapper = new DefaultGLSPMcpServer(sdk, { dataMode: 'tools' });
        return { wrapper, sdk };
    }

    it('tracks every registerTool call so listTools returns the registered set', () => {
        const { wrapper } = makeServer();
        wrapper.registerTool('alpha', { description: 'first', inputSchema: { x: z.string() } }, async () => ({ content: [] }));
        wrapper.registerTool('beta', { description: 'second' }, async () => ({ content: [] }));

        const names = wrapper.listTools().map(tool => tool.description);
        expect(names).to.have.members(['first', 'second']);
        expect(wrapper.listTools()).to.have.lengthOf(2);
    });

    it('tracks registerResource (static URI) and listResources reflects it by name', () => {
        const { wrapper } = makeServer();
        wrapper.registerResource('my-resource', 'glsp://test', { title: 'res', mimeType: 'text/plain' }, async () => ({
            contents: [{ uri: 'glsp://test', text: 'ok' }]
        }));

        const resources = wrapper.listResources();
        expect(resources).to.have.lengthOf(1);
        expect((resources[0] as RegisteredResource).name).to.equal('my-resource');
        expect((resources[0] as RegisteredResource).title).to.equal('res');
    });

    it('tracks registerPrompt and listPrompts reflects it by description', () => {
        const { wrapper } = makeServer();
        wrapper.registerPrompt('describe', { description: 'desc' }, async () => ({ messages: [] }));

        const prompts = wrapper.listPrompts();
        expect(prompts).to.have.lengthOf(1);
        expect(prompts[0].description).to.equal('desc');
    });

    it('getRawServer() returns the exact SDK instance passed in (escape hatch identity)', () => {
        const { wrapper, sdk } = makeServer();
        expect(wrapper.getRawServer()).to.equal(sdk);
    });

    it('dispose() invokes close() on the underlying SDK server', () => {
        const { wrapper, sdk } = makeServer();
        const closeSpy = sinon.spy(sdk, 'close');
        wrapper.dispose();
        expect(closeSpy.calledOnce).to.be.true;
    });
});
