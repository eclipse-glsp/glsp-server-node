/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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
const webpack = require('webpack');
const path = require('path');
const buildRoot = path.resolve(__dirname, 'lib');
const appRoot = path.resolve(__dirname, 'bundle');
const CircularDependencyPlugin = require('circular-dependency-plugin');

module.exports = env => {
    const target = env.target ?? 'node';
    const pathToIndex = target !== 'node' ? 'browser/index' : 'node/index';
    const filename = `wf-glsp-server-${target}.js`;
    return {
        entry: [path.resolve(buildRoot, pathToIndex)],
        output: {
            filename,
            path: appRoot
        },
        mode: 'development',
        devtool: 'source-map',
        resolve: {
            extensions: ['.ts', '.tsx', '.js']
        },
        target,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    use: ['source-map-loader'],
                    enforce: 'pre'
                },
                {
                    test: /\.json$/,
                    type: 'json'
                }
            ]
        },
        plugins: [
            new CircularDependencyPlugin({
                exclude: /(node_modules)\/./,
                failOnError: false
            })
        ],
        ignoreWarnings: [/Failed to parse source map/, /Can't resolve .* in '.*ws\/lib'/]
    };
};
