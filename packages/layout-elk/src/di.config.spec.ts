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
import { DefaultModelState, GGraph, GModelElementConstructor, ModelState } from '@eclipse-glsp/server';
import { StubDiagramConfiguration } from '@eclipse-glsp/server/lib/common/test/mock-util';
import { expect } from 'chai';
import { Container, ContainerModule, injectable } from 'inversify';
import * as sinon from 'sinon';
import { AbstractLayoutConfigurator } from '.';
import { configureELKLayoutModule } from './di.config';
import { DefaultElementFilter, ElementFilter } from './element-filter';
import { FallbackLayoutConfigurator, LayoutConfigurator } from './layout-configurator';

@injectable()
class CustomLayoutConfigurator extends AbstractLayoutConfigurator {}

@injectable()
class CustomElementFilter extends DefaultElementFilter {}

describe('test configureELKLayoutModule', () => {
    const sandbox = sinon.createSandbox();
    const mockDiagramConfiguration = new StubDiagramConfiguration();
    const typeMappings = new Map<string, GModelElementConstructor>();

    typeMappings.set('graph', GGraph);
    sandbox.stub(mockDiagramConfiguration, 'typeMapping').value(typeMappings);
    const modelState = new DefaultModelState();
    const baseModule = new ContainerModule(bind => {
        bind(ModelState).toConstantValue(modelState);
    });
    it('configure with minimal options', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm] });
        const container = new Container();
        container.load(baseModule, elkModule);
        const filter = container.get<ElementFilter>(ElementFilter);
        expect(filter).to.be.an.instanceOf(DefaultElementFilter);
        const configurator = container.get<LayoutConfigurator>(LayoutConfigurator);
        expect(configurator).to.be.an.instanceOf(FallbackLayoutConfigurator);
        const graphOptions = configurator.apply(new GGraph());
        expect(graphOptions).not.to.be.undefined;
        expect(graphOptions!['elk.algorithm']).to.equal(algorithm);
    });

    it('configure with additional default layout options', () => {
        const algorithm = 'layered';
        const defaultLayoutOptions = {
            'elk.direction': 'LEFT',
            'elk.edgeRouting': 'POLYLINE'
        };
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm], defaultLayoutOptions });
        const container = new Container();
        container.load(baseModule, elkModule);
        const configurator = container.get<LayoutConfigurator>(LayoutConfigurator);
        const graphOptions = configurator.apply(new GGraph());
        expect(graphOptions).not.to.be.undefined;
        expect(graphOptions).to.include(defaultLayoutOptions);
    });

    it('configure with custom layout configurator', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm], layoutConfigurator: CustomLayoutConfigurator });
        const container = new Container();
        container.load(baseModule, elkModule);
        const configurator = container.get<LayoutConfigurator>(LayoutConfigurator);
        expect(configurator).to.be.an.instanceOf(CustomLayoutConfigurator);
    });

    it('configure with custom element filter', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm], elementFilter: CustomElementFilter });
        const container = new Container();
        container.load(baseModule, elkModule);
        const filter = container.get<ElementFilter>(ElementFilter);
        expect(filter).to.be.an.instanceOf(CustomElementFilter);
    });
});
