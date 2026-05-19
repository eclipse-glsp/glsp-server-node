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

import { McpServerInitOptions } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { version as packageVersion } from '../../../package.json';
import { SERVER_VERSION, pickInitOptions } from '../../common/server/abstract-mcp-server-launcher';
import { NodeMcpServerLauncher, assertLoopbackOrAcknowledged, isLoopbackHost } from './node-mcp-server-launcher';

describe('NodeMcpServerLauncher · SERVER_VERSION', () => {
    it('matches the package.json version (no stale literal)', () => {
        // Regression guard: the launcher used to hard-code '1.0.0'. Pull from package.json so
        // adopters and MCP clients can tell builds apart via the `serverInfo.version` handshake
        // field.
        expect(SERVER_VERSION).to.equal(packageVersion);
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
        expect(caps).to.have.property('logging');
        expect(caps).to.not.have.property('tools');
        expect(caps).to.not.have.property('resources');
        expect(caps).to.not.have.property('prompts');
    });

    it('declares `tools` with listChanged: false when at least one tool handler binds', () => {
        const caps = buildCaps({ toolHandlers: [{}] }, true);
        expect(caps.tools).to.deep.equal({ listChanged: false });
        expect(caps).to.not.have.property('resources');
        expect(caps).to.not.have.property('prompts');
    });

    it('declares `prompts` when at least one prompt handler binds (server- or diagram-scope)', () => {
        expect(buildCaps({ promptHandlers: [{}] }, true).prompts).to.deep.equal({ listChanged: false });
        expect(buildCaps({ hasDiagramPrompts: true }, true).prompts).to.deep.equal({ listChanged: false });
    });

    it('declares `resources` only in dataMode=resources; otherwise resources count toward `tools`', () => {
        // Diagram-scope resources mutate per GLSP session add/remove → `listChanged: true` is honest.
        const asResources = buildCaps({ hasDiagramResources: true }, true);
        expect(asResources.resources).to.deep.equal({ listChanged: true });
        expect(asResources).to.not.have.property('tools');

        const asTools = buildCaps({ hasDiagramResources: true }, false);
        expect(asTools.tools).to.deep.equal({ listChanged: false });
        expect(asTools).to.not.have.property('resources');
    });

    it('keeps resources.listChanged: false when only server-scope resources are bound (catalog static)', () => {
        const caps = buildCaps({ resourceHandlers: [{}] }, true);
        expect(caps.resources).to.deep.equal({ listChanged: false });
    });
});

describe('NodeMcpServerLauncher · isLoopbackHost', () => {
    it('treats 127.0.0.0/8, localhost, and ::1 as loopback', () => {
        expect(isLoopbackHost('127.0.0.1')).to.equal(true);
        expect(isLoopbackHost('127.55.0.1')).to.equal(true);
        expect(isLoopbackHost('localhost')).to.equal(true);
        expect(isLoopbackHost('::1')).to.equal(true);
    });

    it('treats unspecified, LAN, and public addresses as non-loopback', () => {
        expect(isLoopbackHost('0.0.0.0')).to.equal(false);
        expect(isLoopbackHost('::')).to.equal(false);
        expect(isLoopbackHost('192.168.1.1')).to.equal(false);
        expect(isLoopbackHost('10.0.0.1')).to.equal(false);
        expect(isLoopbackHost('203.0.113.5')).to.equal(false);
    });
});

describe('NodeMcpServerLauncher · assertLoopbackOrAcknowledged (auth footgun)', () => {
    it('passes silently for a loopback bind without acknowledgement', () => {
        expect(() => assertLoopbackOrAcknowledged('127.0.0.1', undefined)).to.not.throw();
        expect(() => assertLoopbackOrAcknowledged('localhost', undefined)).to.not.throw();
    });

    it('throws an actionable error for a non-loopback bind without acknowledgement', () => {
        expect(() => assertLoopbackOrAcknowledged('0.0.0.0', undefined))
            .to.throw(Error)
            .with.property('message')
            .that.matches(/Refusing to bind/)
            .and.matches(/0\.0\.0\.0/)
            .and.matches(/acknowledgedNoAuth/);
    });

    it('passes for a non-loopback bind when acknowledgedNoAuth is true', () => {
        expect(() => assertLoopbackOrAcknowledged('0.0.0.0', true)).to.not.throw();
        expect(() => assertLoopbackOrAcknowledged('192.168.1.50', true)).to.not.throw();
    });

    it('still throws for a non-loopback bind when acknowledgedNoAuth is false (explicit denial)', () => {
        expect(() => assertLoopbackOrAcknowledged('0.0.0.0', false)).to.throw(/Refusing to bind/);
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
        expect(picked).to.deep.equal({ dataMode: 'resources', agentPersona: 'X', eventStoreLimit: 50 });
    });

    it('omits init-side fields that the caller did not set (no `undefined` sneak-through)', () => {
        const picked = pickInitOptions({ dataMode: 'tools' });
        expect(picked).to.deep.equal({ dataMode: 'tools' });
        expect(picked).to.not.have.property('agentPersona');
        expect(picked).to.not.have.property('eventStoreLimit');
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
        expect(picked).to.deep.equal({ dataMode: 'tools' });
        expect(picked).to.not.have.property('host');
        expect(picked).to.not.have.property('allowedHosts');
        expect(picked).to.not.have.property('allowedOrigins');
        expect(picked).to.not.have.property('acknowledgedNoAuth');
    });
});
