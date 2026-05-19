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

import { ProposalString } from '@eclipse-glsp/protocol';

/**
 * MIME type for an MCP resource. Annotating a `mimeType` field with this type prompts the IDE
 * to suggest the listed common values; any other string the MCP SDK accepts is also valid (the
 * `(string & {})` part of `ProposalString` keeps the field free-form).
 *
 * Unlike `MarkersReason` / `EditMode` (closed sets of framework-defined enum values), MIME
 * types are open and IANA-defined — the listed literals are common, not exhaustive. There's
 * no companion const object: at the call site, adopters write the string literal directly
 * (`readonly mimeType: McpMimeType = 'image/png';`).
 */
export type McpMimeType = ProposalString<
    'text/plain' | 'text/markdown' | 'text/html' | 'application/json' | 'image/png' | 'image/jpeg' | 'image/svg+xml'
>;
