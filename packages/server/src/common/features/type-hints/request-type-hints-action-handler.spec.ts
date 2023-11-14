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
import { EdgeTypeHint, RequestTypeHintsAction, SetTypeHintsAction, ShapeTypeHint } from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { DiagramConfiguration } from '../../diagram/diagram-configuration';
import * as mock from '../../test/mock-util';
import { RequestTypeHintsActionHandler } from './request-type-hints-action-handler';

describe('test RequestTypeHintsActionHandler', () => {
    const container = new Container();
    const diagramConfiguration = new mock.StubDiagramConfiguration();
    const shapeTypeHint: ShapeTypeHint = {
        elementTypeId: 'test',
        deletable: true,
        resizable: true,
        repositionable: true,
        reparentable: true
    };
    const edgeTypeHint: EdgeTypeHint = {
        elementTypeId: 'test',
        deletable: true,
        repositionable: true,
        routable: true,
        sourceElementTypeIds: [],
        targetElementTypeIds: []
    };
    diagramConfiguration.shapeTypeHints = [shapeTypeHint];
    diagramConfiguration.edgeTypeHints = [edgeTypeHint];
    container.load(
        new ContainerModule(bind => {
            bind(DiagramConfiguration).toConstantValue(diagramConfiguration);
        })
    );
    const handler = container.resolve(RequestTypeHintsActionHandler);

    it('execute with correct action', async () => {
        const result = await handler.execute(RequestTypeHintsAction.create());

        expect(result).to.have.length(1);
        expect(SetTypeHintsAction.is(result[0])).true;
        expect(result).to.be.deep.equal([
            { edgeHints: [edgeTypeHint], kind: 'setTypeHints', shapeHints: [shapeTypeHint], responseId: '' } as SetTypeHintsAction
        ]);
    });
});
