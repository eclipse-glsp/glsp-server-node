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
import { GlspLayoutConfigurator, SModelIndex } from '@eclipse-glsp/layout-elk';
import { GGraph } from '@eclipse-glsp/server-node';
import { LayoutOptions } from 'elkjs';
import { injectable } from 'inversify';

@injectable()
export class WorkflowLayoutConfigurator extends GlspLayoutConfigurator {
    protected graphOptions(sgraph: GGraph, index: SModelIndex): LayoutOptions | undefined {
        return {
            'elk.algorithm': 'layered'
        };
    }
}
