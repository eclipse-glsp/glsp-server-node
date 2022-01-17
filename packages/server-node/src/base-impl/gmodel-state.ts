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

import { inject, injectable } from 'inversify';
import { ClientId } from '../di/service-identifiers';
import { DefaultModelState } from '../features/model/model-state';

@injectable()
export class GModelState extends DefaultModelState {
    @inject(ClientId)
    readonly clientId: string;

    static readonly SOURCE_URI = 'sourceUri';

    get sourceUri(): string | undefined {
        return this.get(GModelState.SOURCE_URI);
    }
}
