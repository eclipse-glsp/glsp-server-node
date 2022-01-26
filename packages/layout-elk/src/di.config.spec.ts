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
import { DefaultModelState, DiagramConfiguration, GGraph, GModelElementConstructor, ModelState } from '@eclipse-glsp/server-node';
import { StubDiagramConfiguration } from '@eclipse-glsp/server-node/lib/test/mock-util';
import { expect } from 'chai';
import { Container, ContainerModule, injectable } from 'inversify';
import * as sinon from 'sinon';
import { IElementFilter, ILayoutConfigurator } from 'sprotty-elk';
import { SModelIndex } from 'sprotty-protocol';
import { GlspLayoutConfigurator } from '.';
import { configureELKLayoutModule } from './di.config';
import { GlspElementFilter } from './glsp-element-filter';
import { FallbackGlspLayoutConfigurator } from './glsp-layout-configurator';

@injectable()
class CustomLayoutConfigurator extends GlspLayoutConfigurator {}

@injectable()
class CustomElementFilter extends GlspElementFilter {}

describe('test configureELKLayoutModule', () => {
    const sandbox = sinon.createSandbox();
    const mockDiagramConfiguration = new StubDiagramConfiguration();
    const typeMappings = new Map<string, GModelElementConstructor>();

    typeMappings.set('graph', GGraph);
    sandbox.stub(mockDiagramConfiguration, 'typeMapping').value(typeMappings);
    const modelState = new DefaultModelState();
    const baseModule = new ContainerModule(bind => {
        bind(DiagramConfiguration).toConstantValue(mockDiagramConfiguration);
        bind(ModelState).toConstantValue(modelState);
    });
    it('configure with minimal options', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm] });
        const container = new Container();
        container.load(baseModule, elkModule);
        const filter = container.get<IElementFilter>(IElementFilter);
        expect(filter).to.be.instanceOf(GlspElementFilter);
        const configurator = container.get<ILayoutConfigurator>(ILayoutConfigurator);
        expect(configurator).to.be.instanceOf(FallbackGlspLayoutConfigurator);
        const graphOptions = configurator.apply(new GGraph(), new SModelIndex());
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
        const configurator = container.get<ILayoutConfigurator>(ILayoutConfigurator);
        const graphOptions = configurator.apply(new GGraph(), new SModelIndex());
        expect(graphOptions).not.to.be.undefined;
        expect(graphOptions).to.include(defaultLayoutOptions);
    });

    it('configure with custom layout configurator', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm], layoutConfigurator: CustomLayoutConfigurator });
        const container = new Container();
        container.load(baseModule, elkModule);
        const configurator = container.get<ILayoutConfigurator>(ILayoutConfigurator);
        expect(configurator).to.be.instanceOf(CustomLayoutConfigurator);
    });

    it('configure with custom element filter', () => {
        const algorithm = 'layered';
        const elkModule = configureELKLayoutModule({ algorithms: [algorithm], elementFilter: CustomElementFilter });
        const container = new Container();
        container.load(baseModule, elkModule);
        const filter = container.get<IElementFilter>(IElementFilter);
        expect(filter).to.be.instanceOf(CustomElementFilter);
    });
});
