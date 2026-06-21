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

import * as http from 'http';

export interface RawHttpResponse {
    status: number;
    contentType: string | undefined;
    body: string;
}

/**
 * Issue a raw HTTP request to a transport's listening port. Used by spec files that need
 * to bypass the SDK Client to assert wire-level behavior (status codes, error envelopes).
 */
export function rawHttpRequest(
    port: number,
    method: 'POST' | 'GET' | 'DELETE',
    headers: http.OutgoingHttpHeaders,
    body?: unknown
): Promise<RawHttpResponse> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path: '/mcp',
                method,
                headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }
            },
            res => {
                const chunks: Buffer[] = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () =>
                    resolve({
                        status: res.statusCode ?? 0,
                        contentType: res.headers['content-type'],
                        body: Buffer.concat(chunks).toString('utf8')
                    })
                );
            }
        );
        req.on('error', reject);
        req.end(body !== undefined ? JSON.stringify(body) : undefined);
    });
}
