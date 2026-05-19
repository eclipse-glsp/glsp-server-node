/********************************************************************************
 * Copyright (c) 2025-2026 EclipseSource and others.
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
 * Formats a list of per-input notices (errors, warnings, …) as a Markdown bullet list with a
 * leading heading. Returns an empty string when `notices` is empty so callers can append
 * unconditionally.
 */
export function formatNoticeList(kind: string, notices: string[]): string {
    if (notices.length === 0) return '';
    return `\nThe following ${kind} occurred:\n${notices.map(notice => `- ${notice}`).join('\n')}`;
}
