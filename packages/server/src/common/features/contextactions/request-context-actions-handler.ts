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
import { Action, LabeledAction, RequestContextActions, SetContextActions } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { ContextActionsProviderRegistry } from './context-actions-provider-registry';

@injectable()
export class RequestContextActionsHandler implements ActionHandler {
    actionKinds = [RequestContextActions.KIND];

    @inject(ContextActionsProviderRegistry)
    protected contextActionsProviderRegistry: ContextActionsProviderRegistry;

    async execute(action: RequestContextActions): Promise<Action[]> {
        const editorContext = action.editorContext;
        const actions: LabeledAction[] = [];
        if (this.contextActionsProviderRegistry.get(action.contextId)) {
            const provider = this.contextActionsProviderRegistry.get(action.contextId)!;
            (await provider.getActions(editorContext)).forEach(returnAction => actions.push(returnAction));
        }
        return [SetContextActions.create(actions, { args: action.editorContext.args })];
    }
}
