/********************************************************************************
 * Copyright (c) 2022 STMicroelectronics and others.
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
import { DefaultTypes, flatPush, MaybeArray } from '@eclipse-glsp/protocol';
import { GShapeElement, GShapeElementBuilder } from './gshape-element';

export type GIssueSeverity = 'error' | 'warning' | 'info';

export class GIssue {
    message: string;
    severity: GIssueSeverity;
}

export class GIssueMarker extends GShapeElement {
    type = DefaultTypes.ISSUE_MARKER;
    issues: GIssue[] = [];
}

export class GIssueMarkerBuilder<G extends GIssueMarker = GIssueMarker> extends GShapeElementBuilder<G> {
    addIssue(issue: GIssue): this;
    addIssue(message: string, severity: GIssueSeverity): this;
    addIssue(issueOrMessage: GIssue | string, severity?: GIssueSeverity): this {
        if (typeof issueOrMessage === 'object') {
            this.proxy.issues.push(issueOrMessage);
        } else if (severity) {
            this.proxy.issues.push({ message: issueOrMessage, severity });
        }
        return this;
    }

    addIssues(issues: GIssue[]): this;
    addIssues(...issues: GIssue[]): this;
    addIssues(...issues: MaybeArray<GIssue>[]): this {
        flatPush(this.proxy.issues, issues);
        return this;
    }
}
