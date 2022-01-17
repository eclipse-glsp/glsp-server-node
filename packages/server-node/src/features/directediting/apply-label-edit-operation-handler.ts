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
import { GLabel } from '@eclipse-glsp/graph';
import { ApplyLabelEditOperation } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { GLSPServerError } from '../../utils/glsp-server-error';
import { GModelState } from '../../base-impl/gmodel-state';
import { OperationHandler } from '../../operations/operation-handler';

@injectable()
export class ApplyLabelEditOperationHandler implements OperationHandler {
    readonly operationType = ApplyLabelEditOperation.KIND;

    @inject(GModelState)
    protected readonly modelState: GModelState;

    execute(operation: ApplyLabelEditOperation): void {
        const element = this.modelState.index.findByClass(operation.labelId, GLabel);
        if (element) {
            element.text = operation.text;
        } else {
            throw new GLSPServerError('Element with provided ID cannot be found or is not a GLabel');
        }
    }
}
