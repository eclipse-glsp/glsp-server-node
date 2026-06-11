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
// @ts-check
const { resolve } = require('node:path');
const esbuild = require('esbuild');

const watch = process.argv.slice(2).includes('--watch');

/**
 * Reports the build progress and surfaces errors/warnings in a format that
 * VS Code's `$esbuild-watch` problem matcher can pick up.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log(`${watch ? '[watch] ' : ''}build started`);
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log(`${watch ? '[watch] ' : ''}build finished`);
        });
    }
};

// Bundle `vscode-jsonrpc/browser` plus the page-side script into a single file emitted into
// `dist/`, alongside the verbatim assets copied from `public/` and the worker bundle synced
// from `@eclipse-glsp-examples/workflow-server-bundled-web` by `scripts/prepare-dist.mjs`.
/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: [resolve(__dirname, 'src/index.js')],
    outfile: resolve(__dirname, 'dist/index.bundle.js'),
    bundle: true,
    sourcemap: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2019',
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin]
};

async function main() {
    if (watch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
    } else {
        await esbuild.build(config);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
