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
import { Action, MaybePromise, RequestTypeHintsAction, SetTypeHintsAction } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../actions/action-handler';
import { DiagramConfiguration } from './diagram-configuration';

@injectable()
export class RequestTypeHintsActionHandler implements ActionHandler {
    @inject(DiagramConfiguration) protected diagramConfiguration: DiagramConfiguration;
    static KINDS = [RequestTypeHintsAction.KIND];

    execute(action: RequestTypeHintsAction): MaybePromise<Action[]> {
        return [
            SetTypeHintsAction.create({
                shapeHints: this.diagramConfiguration.shapeTypeHints,
                edgeHints: this.diagramConfiguration.edgeTypeHints
            })
        ];
    }

    readonly actionKinds = [RequestTypeHintsAction.KIND];
}
