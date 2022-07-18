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
import { GModelElement } from '@eclipse-glsp/graph';
import { ValidationStatus } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';

/**
 * A validator that validates a new label for a given {@link GModelElement}.
 */
@injectable()
export abstract class LabelEditValidator {
    static readonly CONTEXT_ID = 'label-edit';

    /**
     * Returns the {@link ValidationStatus} for a given edited label of a {@link GModelElement}.
     *
     * @param label   The edited label to validate.
     * @param element The element for which the label is going to be edited.
     * @returns The {@link ValidationStatus} of the label.
     */
    abstract validate(label: string, element: GModelElement): ValidationStatus;
}
