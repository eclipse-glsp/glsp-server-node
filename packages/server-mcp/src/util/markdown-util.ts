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

/**
 * This function serializes a given array of objects into a Markdown table string.
 */
export function objectArrayToMarkdownTable(data: Record<string, any>[]): string {
    if (!data.length) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

    const dataRows = data.map((obj: Record<string, any>) => {
        const rowString = headers
            .map(header => {
                const value = obj[header] ?? '';
                if (typeof value === 'object') {
                    return JSON.stringify(value).replace(/"/g, '');
                }
                return value;
            })
            .join(' | ');
        return `| ${rowString} |`;
    });

    return [headerRow, separatorRow, ...dataRows].join('\n');
}
