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
import { Action, ResolveNavigationTargetAction, SetResolvedNavigationTargetAction } from '@eclipse-glsp/protocol';
import { inject, injectable, optional } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { NavigationTargetResolver } from './navigation-target-resolver';
import { Logger } from '../../utils/logger';

@injectable()
export class ResolveNavigationTargetsActionHandler implements ActionHandler {
    actionKinds = [ResolveNavigationTargetAction.KIND];

    @inject(Logger)
    protected logger: Logger;

    @inject(NavigationTargetResolver)
    @optional()
    protected readonly navigationTargetResolver: NavigationTargetResolver;

    async execute(action: ResolveNavigationTargetAction): Promise<Action[]> {
        if (!this.navigationTargetResolver) {
            this.logger.warn('Could not resolve navigation target. No implementation for: NavigationTargetResolver has been bound');
            return [];
        }
        const target = action.navigationTarget;
        const resolution = await this.navigationTargetResolver.resolve(target);
        return [new SetResolvedNavigationTargetAction(resolution.elementIds, resolution.args)];
    }
}
