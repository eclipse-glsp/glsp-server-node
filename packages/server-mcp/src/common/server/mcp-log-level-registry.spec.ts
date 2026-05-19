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

import { expect } from 'chai';
import { DefaultMcpLogLevelRegistry, passesLogThreshold } from './mcp-log-level-registry';

describe('passesLogThreshold (G4 severity gate)', () => {
    it('passes a level whose severity is at or above the threshold (RFC 5424: lower number = more severe)', () => {
        // Threshold 'warning' (4) keeps emergency..warning, drops notice..debug.
        expect(passesLogThreshold('emergency', 'warning')).to.equal(true);
        expect(passesLogThreshold('error', 'warning')).to.equal(true);
        expect(passesLogThreshold('warning', 'warning')).to.equal(true);
        expect(passesLogThreshold('notice', 'warning')).to.equal(false);
        expect(passesLogThreshold('info', 'warning')).to.equal(false);
        expect(passesLogThreshold('debug', 'warning')).to.equal(false);
    });

    it('passes everything when the threshold is debug (the default)', () => {
        for (const level of ['emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'] as const) {
            expect(passesLogThreshold(level, 'debug')).to.equal(true);
        }
    });

    it('passes only emergency when the threshold is emergency', () => {
        expect(passesLogThreshold('emergency', 'emergency')).to.equal(true);
        expect(passesLogThreshold('alert', 'emergency')).to.equal(false);
        expect(passesLogThreshold('debug', 'emergency')).to.equal(false);
    });
});

describe('DefaultMcpLogLevelRegistry', () => {
    it('returns the default level for an unknown session id', () => {
        const registry = new DefaultMcpLogLevelRegistry();
        expect(registry.getLevel('never-set')).to.equal(DefaultMcpLogLevelRegistry.DEFAULT_LEVEL);
    });

    it('returns the default level when sessionId is undefined (out-of-band logger calls)', () => {
        const registry = new DefaultMcpLogLevelRegistry();
        expect(registry.getLevel(undefined)).to.equal(DefaultMcpLogLevelRegistry.DEFAULT_LEVEL);
    });

    it('persists the most recent setLevel value per session and isolates across sessions', () => {
        const registry = new DefaultMcpLogLevelRegistry();
        registry.setLevel('A', 'warning');
        registry.setLevel('B', 'error');
        expect(registry.getLevel('A')).to.equal('warning');
        expect(registry.getLevel('B')).to.equal('error');

        registry.setLevel('A', 'info');
        expect(registry.getLevel('A')).to.equal('info');
        expect(registry.getLevel('B')).to.equal('error');
    });

    it('clear(sessionId) drops the entry so a recycled session id starts at the default', () => {
        const registry = new DefaultMcpLogLevelRegistry();
        registry.setLevel('reused', 'error');
        expect(registry.getLevel('reused')).to.equal('error');

        registry.clear('reused');
        expect(registry.getLevel('reused')).to.equal(DefaultMcpLogLevelRegistry.DEFAULT_LEVEL);
    });
});
