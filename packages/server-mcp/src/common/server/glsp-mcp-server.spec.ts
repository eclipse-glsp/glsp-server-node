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

import { NullLogger } from '@eclipse-glsp/server';
import { McpServer, RegisteredResource } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';
import { DefaultGLSPMcpServer } from './glsp-mcp-server';

describe('DefaultGLSPMcpServer', () => {
    function makeServer(): { wrapper: DefaultGLSPMcpServer; sdk: McpServer } {
        const sdk = new McpServer({ name: 'test', version: '1.0.0' }, { capabilities: {} });
        const wrapper = new DefaultGLSPMcpServer(sdk, { dataMode: 'tools' }, new NullLogger());
        return { wrapper, sdk };
    }

    it('tracks every registerTool call so listTools returns the registered set', () => {
        const { wrapper } = makeServer();
        wrapper.registerTool('alpha', { description: 'first', inputSchema: { x: z.string() } }, async () => ({ content: [] }));
        wrapper.registerTool('beta', { description: 'second' }, async () => ({ content: [] }));

        const names = wrapper.listTools().map(tool => tool.description);
        expect([...names].sort()).toEqual(['first', 'second'].sort());
        expect(wrapper.listTools()).toHaveLength(2);
    });

    it('tracks registerResource (static URI) and listResources reflects it by name', () => {
        const { wrapper } = makeServer();
        wrapper.registerResource('my-resource', 'glsp://test', { title: 'res', mimeType: 'text/plain' }, async () => ({
            contents: [{ uri: 'glsp://test', text: 'ok' }]
        }));

        const resources = wrapper.listResources();
        expect(resources).toHaveLength(1);
        expect((resources[0] as RegisteredResource).name).toBe('my-resource');
        expect((resources[0] as RegisteredResource).title).toBe('res');
    });

    it('tracks registerPrompt and listPrompts reflects it by description', () => {
        const { wrapper } = makeServer();
        wrapper.registerPrompt('describe', { description: 'desc' }, async () => ({ messages: [] }));

        const prompts = wrapper.listPrompts();
        expect(prompts).toHaveLength(1);
        expect(prompts[0].description).toBe('desc');
    });

    it('getRawServer() returns the exact SDK instance passed in (escape hatch identity)', () => {
        const { wrapper, sdk } = makeServer();
        expect(wrapper.getRawServer()).toBe(sdk);
    });

    it('dispose() invokes close() on the underlying SDK server', () => {
        const { wrapper, sdk } = makeServer();
        const closeSpy = vi.spyOn(sdk, 'close');
        wrapper.dispose();
        expect(closeSpy).toHaveBeenCalledOnce();
    });
});
