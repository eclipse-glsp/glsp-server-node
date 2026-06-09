/********************************************************************************
 * Copyright (c) 2022-2026 EclipseSource and others.
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
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
const esbuild = require('esbuild');

const argv = process.argv.slice(2);
const watch = argv.includes('--watch');
// Dev mode: build only the node target and (re)start the server after each successful build.
const runNode = argv.includes('--run-node');
// Everything after `--` is forwarded verbatim to the spawned node server (e.g. `--port 5007`).
const dashDash = argv.indexOf('--');
const serverArgs = dashDash >= 0 ? argv.slice(dashDash + 1) : [];

const bundledDir = resolve(__dirname, '..', 'workflow-server-bundled');
const bundledWebDir = resolve(__dirname, '..', 'workflow-server-bundled-web');

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

/** @type {import('esbuild').BuildOptions} */
const common = {
    bundle: true,
    // Minify one-shot production builds; keep watch/dev output readable and fast to rebuild.
    // `sourcemap` still maps the (minified) output back to the original TypeScript sources.
    minify: !watch,
    // Preserve original class/function names through minification — GLSP's logger and error
    // messages use `constructor.name` for labels, which would otherwise be mangled.
    keepNames: true,
    sourcemap: true,
    logLevel: 'silent',
    tsconfig: resolve(__dirname, 'tsconfig.json'),
    plugins: [esbuildProblemMatcherPlugin]
};

/** @type {import('esbuild').BuildOptions} */
const nodeConfig = {
    ...common,
    entryPoints: [resolve(__dirname, 'src/node/app.ts')],
    outfile: resolve(bundledDir, 'wf-glsp-server-node.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    // `ws` requires these optional native deps in a try/catch; keep them external so the
    // graceful-fallback path works and esbuild does not error on the missing modules.
    external: ['bufferutil', 'utf-8-validate']
};

/** @type {import('esbuild').BuildOptions} */
const webworkerConfig = {
    ...common,
    entryPoints: [resolve(__dirname, 'src/browser/app.ts')],
    outfile: resolve(bundledWebDir, 'wf-glsp-server-webworker.js'),
    platform: 'browser',
    format: 'iife',
    target: 'es2019',
    // Honor the legacy `browser` package field + browser condition for transitive deps.
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser']
};

/** Restart the bundled node server after every successful build. */
function runNodePlugin() {
    /** @type {import('node:child_process').ChildProcess | undefined} */
    let child;
    const stop = () => child?.kill('SIGTERM');
    process.on('SIGINT', () => {
        stop();
        process.exit(0);
    });
    return {
        name: 'run-node-server',
        setup(build) {
            build.onEnd(result => {
                if (result.errors.length > 0) {
                    // Keep the last good server running so a broken build does not crash the loop.
                    return;
                }
                stop();
                child = spawn('node', ['--enable-source-maps', nodeConfig.outfile, ...serverArgs], { stdio: 'inherit' });
            });
        }
    };
}

async function run(config) {
    if (watch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
    } else {
        await esbuild.build(config);
    }
}

async function main() {
    if (runNode) {
        await run({ ...nodeConfig, plugins: [esbuildProblemMatcherPlugin, runNodePlugin()] });
    } else {
        await Promise.all([run(nodeConfig), run(webworkerConfig)]);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
