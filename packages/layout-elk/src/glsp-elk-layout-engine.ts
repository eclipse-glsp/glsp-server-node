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
import { LayoutEngine, ModelState } from '@eclipse-glsp/server-node';
import { inject, injectable } from 'inversify';
import { ElkFactory, ElkLayoutEngine, IElementFilter, ILayoutConfigurator } from 'sprotty-elk/lib/inversify';
import { SModelElement } from 'sprotty-protocol/lib/model';
import { BasicTypeMapper } from './basic-type-mapper';

/**
 * Layout engine that delegates to ELK by transforming the graphical model into an ELK graph.
 */
@injectable()
export class BaseElkLayoutEngine extends ElkLayoutEngine {
    constructor(
        @inject(ElkFactory) elkFactory: ElkFactory,
        @inject(IElementFilter) protected readonly filter: IElementFilter,
        @inject(ILayoutConfigurator) protected readonly configurator: ILayoutConfigurator,
        @inject(BasicTypeMapper) protected typeMapper: BasicTypeMapper
    ) {
        super(elkFactory, filter, configurator);
    }

    protected getBasicType(smodel: SModelElement): string {
        return this.typeMapper.getBasicType(smodel);
    }
}

/**
 * A implement of GLSP's {@link LayoutEngine} interface that retrieves the graphical model from the {@link ModelState}
 * and delegates the to an underlying {@link BaseElkLayoutEngine} instance for computing the layout.
 */
@injectable()
export class GlspElkLayoutEngine implements LayoutEngine {
    @inject(ModelState)
    protected modelState: ModelState;

    @inject(BaseElkLayoutEngine)
    protected elkLayoutEngine: BaseElkLayoutEngine;

    async layout(): Promise<void> {
        const graph = this.modelState.root;
        await this.elkLayoutEngine.layout(graph);
    }
}
