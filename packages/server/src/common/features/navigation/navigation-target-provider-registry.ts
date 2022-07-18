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
import { multiInject, optional } from 'inversify';
import { NavigationTargetProviders } from '../../di/service-identifiers';
import { Registry } from '../../utils/registry';
import { NavigationTargetProvider } from './navigation-target-provider';

export const NavigationTargetProviderRegistry = Symbol('NavigationTargetProviderRegistry');

/**
 * This registry keeps track of registered {@link NavigationTargetProvider} for a certain target types.
 */
export interface NavigationTargetProviderRegistry extends Registry<string, NavigationTargetProvider> {}

export class DefaultNavigationTargetProviderRegistry
    extends Registry<string, NavigationTargetProvider>
    implements NavigationTargetProviderRegistry
{
    constructor(@multiInject(NavigationTargetProviders) @optional() navigationTargetProviders: NavigationTargetProvider[] = []) {
        super();
        navigationTargetProviders.forEach(provider => this.register(provider.targetTypeId, provider));
    }
}
