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

// Populates `dist/` with everything `serve` needs that webpack doesn't emit:
//  - verbatim files from `public/` (index.html, mcp-service-worker.js)
//  - the worker bundle from `@eclipse-glsp-examples/workflow-server-bundled-web`
// Webpack writes `index.bundle.js` into the same dir as a separate step.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = new URL('..', import.meta.url).pathname;
const dist = join(here, 'dist');

mkdirSync(dist, { recursive: true });

// 1. Verbatim assets from ./public/
const publicDir = join(here, 'public');
if (existsSync(publicDir)) {
    for (const entry of readdirSync(publicDir)) {
        const source = join(publicDir, entry);
        if (statSync(source).isFile()) {
            copyFileSync(source, join(dist, entry));
        }
    }
}

// 2. Worker bundle from the bundled-web dependency
const workerPackage = dirname(require.resolve('@eclipse-glsp-examples/workflow-server-bundled-web/package.json'));
const workerFiles = ['wf-glsp-server-webworker.js', 'wf-glsp-server-webworker.js.map'];
for (const file of workerFiles) {
    const source = join(workerPackage, file);
    if (!existsSync(source)) {
        console.error(`[prepare-dist] Missing ${source} — build workflow-server first.`);
        process.exit(1);
    }
    copyFileSync(source, join(dist, file));
}

console.log('[prepare-dist] dist/ populated (public assets + worker bundle)');
