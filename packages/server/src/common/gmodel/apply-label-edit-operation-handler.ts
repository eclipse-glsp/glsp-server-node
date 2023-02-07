/********************************************************************************
 * Copyright (c) 2022-2023 STMicroelectronics and others.
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
import { ApplyLabelEditOperation, MaybePromise } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { getOrThrow } from '../utils/glsp-server-error';
import { GModelOperationHandler } from './gmodel-operation-handler';

@injectable()
export class GModelApplyLabelEditOperationHandler extends GModelOperationHandler {
    readonly operationType = ApplyLabelEditOperation.KIND;

    createCommand(operation: ApplyLabelEditOperation): MaybePromise<Command | undefined> {
        const label = getOrThrow(
            this.modelState.index.findByClass(operation.labelId, GLabel),
            'Element with provided ID cannot be found or is not a GLabel'
        );
        return label.text !== operation.text //
            ? this.commandOf(() => (label.text = operation.text))
            : undefined;
    }
}
