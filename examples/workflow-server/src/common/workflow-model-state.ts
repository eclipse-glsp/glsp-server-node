/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { DefaultModelState, GModelElementSchema } from '@eclipse-glsp/server';
import { injectable } from 'inversify';

/**
 * This model state serves to demonstrate how to extend or create a custom model state.
 *
 * While this may not be necessary when handling JSON formatted graphs that already
 * correspond to a GModel (as the Workflow example does), since {@link DefaultModelState}
 * is sufficient, it nonetheless provides an adequte example for custom formats.
 */
@injectable()
export class WorkflowModelState extends DefaultModelState {
    /**
     * The source model that needs to be transformed into a GModel and its {@link GModelRoot}.
     * It is saved in the {@link ModelState} in order to later be available in the
     * corresponding {@link GModelFactory}.
     *
     * Its type solely depends on the used source model.
     */
    model: GModelElementSchema;
}
