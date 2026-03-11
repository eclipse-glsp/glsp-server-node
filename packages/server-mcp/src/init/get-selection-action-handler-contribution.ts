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

import { ActionHandlerFactory, ActionHandlerRegistry, Args, ClientSessionInitializer } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { GetSelectionMcpToolHandler } from '../tools';

/**
 * This `ClientSessionInitializer` serves to register an additional `ActionHandler` without needing to extend `ServerModule`.
 *
 * See `ActionHandlerRegistryInitializer`
 */
@injectable()
export class GetSelectionActionHandlerInitContribution implements ClientSessionInitializer {
    @inject(ActionHandlerFactory)
    protected factory: ActionHandlerFactory;
    @inject(ActionHandlerRegistry)
    protected registry: ActionHandlerRegistry;
    @inject(GetSelectionMcpToolHandler)
    protected handler: GetSelectionMcpToolHandler;

    initialize(args?: Args): void {
        this.registry.registerHandler(this.handler);
    }
}
