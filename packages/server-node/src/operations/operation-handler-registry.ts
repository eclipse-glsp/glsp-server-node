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
import { Args } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { Registry } from '../utils/registry';
import { CreateOperationHandler } from './create-operation-handler';
import { OperationHandler, OperationHandlerConstructor, OperationHandlerFactory } from './operation-handler';

@injectable()
export class OperationHandlerRegistry extends Registry<string, OperationHandler> {
    registerHandler(handler: OperationHandler): boolean {
        if (handler instanceof CreateOperationHandler) {
            handler.elementTypeIds.forEach(typeId => this.register(`${handler.operationType}_${typeId}`, handler));
            return true;
        } else {
            return this.register(handler.operationType, handler);
        }
    }
}

@injectable()
export class OperationHandlerRegistryInitializer implements ClientSessionInitializer {
    @inject(OperationHandlerFactory)
    protected factory: OperationHandlerFactory;

    @inject(OperationHandlerConstructor)
    @optional()
    protected handlerConstructors: OperationHandlerConstructor[] = [];

    @inject(OperationHandlerRegistry)
    protected registry: OperationHandlerRegistry;

    initialize(args?: Args): void {
        const handlers = this.handlerConstructors.map(constructor => this.factory(constructor));
        handlers.forEach(handler => this.registry.registerHandler(handler));
    }
}
