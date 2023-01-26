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
import { Args } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { MultiRegistry } from '../utils/registry';
import { ActionHandler, ActionHandlerConstructor, ActionHandlerFactory } from './action-handler';

/**
 * An action handler registry keeps track of registered action handlers for a certain action.
 */
@injectable()
export class ActionHandlerRegistry extends MultiRegistry<string, ActionHandler> {
    registerHandler(handler: ActionHandler): void {
        return handler.actionKinds.forEach(kind => this.register(kind, handler));
    }

    /**
     * Retrieve all registered {@link ActionHandler}s that can handle the given action.
     * The resulting list is ordered descending using {@link ActionHandler.getPriority}.
     *
     * @param action The action
     * @returns A list of all registered handlers that can handle the given action.
     */
    override get(key: string): ActionHandler[] {
        const result = super.get(key);
        return result.sort((a, b) => a.priority ?? 0 - (b.priority ?? 0));
    }
}

@injectable()
export class ActionHandlerRegistryInitializer implements ClientSessionInitializer {
    @inject(ActionHandlerFactory)
    protected factory: ActionHandlerFactory;

    @inject(ActionHandlerConstructor)
    @optional()
    protected handlerConstructors: ActionHandlerConstructor[] = [];

    @inject(ActionHandlerRegistry)
    protected registry: ActionHandlerRegistry;

    initialize(_args?: Args): void {
        const handlers = this.handlerConstructors.map(constructor => this.factory(constructor));
        handlers.forEach(handler => this.registry.registerHandler(handler));
    }
}
