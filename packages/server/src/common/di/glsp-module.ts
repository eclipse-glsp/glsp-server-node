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
import { ContainerModule, injectable, interfaces } from 'inversify';
import { AbstractMultiBinding } from './multi-binding';

/**
 * A wrapper interface to get access to the binding related functions
 * for a inversify container.
 */
export interface ModuleContext {
    bind: interfaces.Bind;
    unbind: interfaces.Unbind;
    isBound: interfaces.IsBound;
    rebind: interfaces.Rebind;
}

/**
 * Common super class for GLSP {@link ContainerModule}s.
 */
@injectable()
export abstract class GLSPModule extends ContainerModule {
    public static CLIENT_ACTIONS = 'ClientActions';

    protected context: ModuleContext;

    constructor() {
        super((bind, unbind, isBound, rebind) => {
            this.context = { bind, unbind, isBound, rebind };
            this.configure(bind, unbind, isBound, rebind);
        });
    }

    protected abstract configure(
        bind: interfaces.Bind,
        unbind: interfaces.Unbind,
        isBound: interfaces.IsBound,
        rebind: interfaces.Rebind
    ): void;

    /**
     * Configuration method for multibound values. The passed configurator is typically a submethod of this module. This
     * means
     * that subclasses can customize the {@link MultiBinding} object before the actual {@link MultiBinding} is created.
     *
     * @param <T>          Type of the {@link MultiBinding}
     * @param binding      The multi binding configuration object
     * @param configurator The consumer that should be used to configure the given {@link MultiBinding}
     */
    protected configureMultiBinding<T>(binding: AbstractMultiBinding<T>, configurator: (binding: AbstractMultiBinding<T>) => void): void {
        configurator(binding);
        binding.applyBindings(this.context);
    }
}
