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
import { DefaultMcpIdAliasService, NullMcpIdAliasService } from './mcp-id-alias-service';

describe('DefaultMcpIdAliasService', () => {
    it('returns the same alias on repeated calls with the same id (round-trip stability)', () => {
        const service = new DefaultMcpIdAliasService();

        const aliasA = service.alias('uuid-a');
        const aliasA2 = service.alias('uuid-a');
        const aliasB = service.alias('uuid-b');

        expect(aliasA).to.equal(aliasA2);
        expect(aliasA).to.not.equal(aliasB);
        // Aliases are integer strings, starting at "1".
        expect(aliasA).to.match(/^\d+$/);
        expect(aliasB).to.match(/^\d+$/);
    });

    it('lookup(alias) returns the original id (round-trip)', () => {
        const service = new DefaultMcpIdAliasService();

        const alias = service.alias('uuid-foo');
        expect(service.lookup(alias)).to.equal('uuid-foo');
    });

    it('lookup(unknown) returns the input verbatim (best-effort fallback)', () => {
        const service = new DefaultMcpIdAliasService();

        // Unknown ids may come from manual user input, copy-paste, or earlier server-side
        // state. The service passes them through; downstream existence checks decide.
        expect(service.lookup('never-issued')).to.equal('never-issued');
    });

    it('skips alias candidates that collide with a known real id (no shadowing)', () => {
        // Regression: pre-fix, alias() always handed out sequential integers starting at "1".
        // A model element whose actual id was "1" would then be shadowed — `lookup("1")`
        // resolved to the *aliased* real id rather than passing through to the real "1".
        // The service now records every real id seen via alias() and skips counter values
        // that would collide.
        const service = new DefaultMcpIdAliasService();
        const aliasOf1 = service.alias('1');
        const aliasOfX = service.alias('uuid-other');

        expect(aliasOf1).to.not.equal('1');
        expect(aliasOfX).to.not.equal('1');
        expect(service.lookup('1')).to.equal('1');
        expect(service.lookup(aliasOf1)).to.equal('1');
        expect(service.lookup(aliasOfX)).to.equal('uuid-other');

        // Multiple pre-known real ids: every issued alias is outside the known-real set.
        const service2 = new DefaultMcpIdAliasService();
        const knownReals = ['1', '2', '3'];
        knownReals.forEach(id => service2.alias(id));
        const fresh = service2.alias('uuid-fresh');
        expect(knownReals).to.not.include(fresh);
    });

    it('keeps independent counters and maps across separate instances (per-session isolation)', () => {
        // Adopters get one instance per GLSP session; aliases must not bleed between sessions.
        const sessionA = new DefaultMcpIdAliasService();
        const sessionB = new DefaultMcpIdAliasService();

        const aliasA1 = sessionA.alias('uuid-x');
        const aliasA2 = sessionA.alias('uuid-y');
        const aliasB1 = sessionB.alias('uuid-z');

        // Counters are independent: B's first alias is "1", same as A's first.
        expect(aliasA1).to.equal('1');
        expect(aliasA2).to.equal('2');
        expect(aliasB1).to.equal('1');

        // Bleed-isolation: alias "1" in B resolves to uuid-z, NOT to uuid-x (A's "1").
        expect(sessionA.lookup('1')).to.equal('uuid-x');
        expect(sessionB.lookup('1')).to.equal('uuid-z');

        // Unknown ids in either session fall through to the input verbatim.
        expect(sessionA.lookup('3')).to.equal('3');
        expect(sessionB.lookup('2')).to.equal('2');
    });
});

describe('NullMcpIdAliasService', () => {
    it('alias and lookup return the argument unchanged', () => {
        const service = new NullMcpIdAliasService();

        expect(service.alias('uuid-foo')).to.equal('uuid-foo');
        expect(service.lookup('uuid-foo')).to.equal('uuid-foo');
        expect(service.lookup('never-seen')).to.equal('never-seen');
    });
});
