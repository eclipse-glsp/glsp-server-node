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

import { McpServerInitOptions } from '@eclipse-glsp/server';
import { describe, expect, it } from 'vitest';
import { version as packageVersion } from '../../../package.json';
import { SERVER_VERSION, pickInitOptions } from '../../common/server/abstract-mcp-server-launcher';
import { NodeMcpServerLauncher, assertLoopbackOrAcknowledged, isLoopbackHost } from './node-mcp-server-launcher';

describe('NodeMcpServerLauncher · SERVER_VERSION', () => {
    it('matches the package.json version (no stale literal)', () => {
        // Regression guard: the launcher used to hard-code '1.0.0'. Pull from package.json so
        // adopters and MCP clients can tell builds apart via the `serverInfo.version` handshake
        // field.
        expect(SERVER_VERSION).toBe(packageVersion);
    });
});

describe('NodeMcpServerLauncher · buildCapabilities', () => {
    /**
     * Sidestep DI: build a stub whose shape matches the fields `buildCapabilities` reads, then
     * invoke the prototype method against it. The method is protected, so we cast through.
     */
    function buildCaps(
        args: {
            toolHandlers?: unknown[];
            promptHandlers?: unknown[];
            resourceHandlers?: unknown[];
            hasDiagramTools?: boolean;
            hasDiagramPrompts?: boolean;
            hasDiagramResources?: boolean;
        },
        resourcesAsResources: boolean
    ): Record<string, unknown> {
        const stub = {
            toolHandlers: args.toolHandlers ?? [],
            promptHandlers: args.promptHandlers ?? [],
            resourceHandlers: args.resourceHandlers ?? [],
            dispatcher: {
                hasDiagramTools: () => args.hasDiagramTools ?? false,
                hasDiagramPrompts: () => args.hasDiagramPrompts ?? false,
                hasDiagramResources: () => args.hasDiagramResources ?? false
            }
        };
        const proto = NodeMcpServerLauncher.prototype as unknown as {
            buildCapabilities(this: typeof stub, resourcesAsResources: boolean): Record<string, unknown>;
        };
        return proto.buildCapabilities.call(stub, resourcesAsResources);
    }

    it('omits `tools`, `resources`, and `prompts` when nothing is bound (regression: resources/list -32601)', () => {
        const caps = buildCaps({}, /* resourcesAsResources */ true);
        expect(caps).toHaveProperty('logging');
        expect(caps).not.toHaveProperty('tools');
        expect(caps).not.toHaveProperty('resources');
        expect(caps).not.toHaveProperty('prompts');
    });

    it('declares `tools` with listChanged: false when at least one tool handler binds', () => {
        const caps = buildCaps({ toolHandlers: [{}] }, true);
        expect(caps.tools).toEqual({ listChanged: false });
        expect(caps).not.toHaveProperty('resources');
        expect(caps).not.toHaveProperty('prompts');
    });

    it('declares `prompts` when at least one prompt handler binds (server- or diagram-scope)', () => {
        expect(buildCaps({ promptHandlers: [{}] }, true).prompts).toEqual({ listChanged: false });
        expect(buildCaps({ hasDiagramPrompts: true }, true).prompts).toEqual({ listChanged: false });
    });

    it('declares `resources` only in dataMode=resources; otherwise resources count toward `tools`', () => {
        // Diagram-scope resources mutate per GLSP session add/remove → `listChanged: true` is honest.
        const asResources = buildCaps({ hasDiagramResources: true }, true);
        expect(asResources.resources).toEqual({ listChanged: true });
        expect(asResources).not.toHaveProperty('tools');

        const asTools = buildCaps({ hasDiagramResources: true }, false);
        expect(asTools.tools).toEqual({ listChanged: false });
        expect(asTools).not.toHaveProperty('resources');
    });

    it('keeps resources.listChanged: false when only server-scope resources are bound (catalog static)', () => {
        const caps = buildCaps({ resourceHandlers: [{}] }, true);
        expect(caps.resources).toEqual({ listChanged: false });
    });
});

describe('NodeMcpServerLauncher · isLoopbackHost', () => {
    it('treats 127.0.0.0/8, localhost, and ::1 as loopback', () => {
        expect(isLoopbackHost('127.0.0.1')).toBe(true);
        expect(isLoopbackHost('127.55.0.1')).toBe(true);
        expect(isLoopbackHost('localhost')).toBe(true);
        expect(isLoopbackHost('::1')).toBe(true);
    });

    it('treats unspecified, LAN, and public addresses as non-loopback', () => {
        expect(isLoopbackHost('0.0.0.0')).toBe(false);
        expect(isLoopbackHost('::')).toBe(false);
        expect(isLoopbackHost('192.168.1.1')).toBe(false);
        expect(isLoopbackHost('10.0.0.1')).toBe(false);
        expect(isLoopbackHost('203.0.113.5')).toBe(false);
    });
});

describe('NodeMcpServerLauncher · assertLoopbackOrAcknowledged (auth footgun)', () => {
    it('passes silently for a loopback bind without acknowledgement', () => {
        expect(() => assertLoopbackOrAcknowledged('127.0.0.1', undefined)).not.toThrow();
        expect(() => assertLoopbackOrAcknowledged('localhost', undefined)).not.toThrow();
    });

    it('throws an actionable error for a non-loopback bind without acknowledgement', () => {
        const act = (): void => assertLoopbackOrAcknowledged('0.0.0.0', undefined);
        expect(act).toThrow(Error);
        expect(act).toThrow(/Refusing to bind/);
        expect(act).toThrow(/0\.0\.0\.0/);
        expect(act).toThrow(/acknowledgedNoAuth/);
    });

    it('passes for a non-loopback bind when acknowledgedNoAuth is true', () => {
        expect(() => assertLoopbackOrAcknowledged('0.0.0.0', true)).not.toThrow();
        expect(() => assertLoopbackOrAcknowledged('192.168.1.50', true)).not.toThrow();
    });

    it('still throws for a non-loopback bind when acknowledgedNoAuth is false (explicit denial)', () => {
        expect(() => assertLoopbackOrAcknowledged('0.0.0.0', false)).toThrow(/Refusing to bind/);
    });
});

// Compile-time exhaustiveness check — fails the build if `McpServerInitOptions` grows or
// shrinks while the `pickInitOptions` destructure doesn't follow.
type _Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
function assertPickInitKeysExhaustive(
    _: _Equal<keyof import('@eclipse-glsp/server').McpServerInitOptions, 'dataMode' | 'agentPersona' | 'eventStoreLimit'>
): void {
    /* type-only */
}
assertPickInitKeysExhaustive(true);

describe('NodeMcpServerLauncher · pickInitOptions (deploy/init split — defense-in-depth)', () => {
    it('passes through every allowed init-side field unchanged', () => {
        const picked = pickInitOptions({ dataMode: 'resources', agentPersona: 'X', eventStoreLimit: 50 });
        expect(picked).toEqual({ dataMode: 'resources', agentPersona: 'X', eventStoreLimit: 50 });
    });

    it('omits init-side fields that the caller did not set (no `undefined` sneak-through)', () => {
        const picked = pickInitOptions({ dataMode: 'tools' });
        expect(picked).toEqual({ dataMode: 'tools' });
        expect(picked).not.toHaveProperty('agentPersona');
        expect(picked).not.toHaveProperty('eventStoreLimit');
    });

    it('strips deploy-only keys smuggled in via JSON wire payload (host, allowedHosts, allowedOrigins, acknowledgedNoAuth)', () => {
        // Simulate a malicious/malformed wire payload: the static type rules these out, but
        // JSON parsing does not, so the destructure-pick must drop them.
        const wirePayload = JSON.parse(`{
            "dataMode": "tools",
            "host": "0.0.0.0",
            "allowedHosts": ["evil.example.com"],
            "allowedOrigins": ["https://evil.example.com"],
            "acknowledgedNoAuth": true
        }`) as McpServerInitOptions;

        const picked = pickInitOptions(wirePayload);
        expect(picked).toEqual({ dataMode: 'tools' });
        expect(picked).not.toHaveProperty('host');
        expect(picked).not.toHaveProperty('allowedHosts');
        expect(picked).not.toHaveProperty('allowedOrigins');
        expect(picked).not.toHaveProperty('acknowledgedNoAuth');
    });
});
