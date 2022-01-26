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
import { LayoutOptions } from 'elkjs';
import { inject, injectable } from 'inversify';
import { DefaultLayoutConfigurator } from 'sprotty-elk';
import { SGraph, SModelElement, SModelIndex } from 'sprotty-protocol';
import { BasicTypeMapper } from './basic-type-mapper';

/**
 * Configurator for ELK layout algorithms; provides mappings of layout options for each model element.
 * For a list of all available layout options checkout the official ELK documentation.
 * A minimal configuration should at least specify the `elk.algorithm` option as
 * return value of {@link GlspLayoutConfigurator.graphOptions}.
 * {@link https://www.eclipse.org/elk/reference/options.html}
 */
@injectable()
export class GlspLayoutConfigurator extends DefaultLayoutConfigurator {
    @inject(BasicTypeMapper)
    protected typeMapper: BasicTypeMapper;

    protected getBasicType(smodel: SModelElement): string {
        return this.typeMapper.getBasicType(smodel);
    }
}

/**
 * A fallback configurator that is used in the `configureELKLayoutModule` utility method.
 * If no explicit layout configurator binding is provided a new instance of the fallback configurator is
 * bound as replacement. Basic layout options for the root graph element are derived from the
 * configuration parameters that haven been passed to the `configureELKLayoutModule` function.
 */
@injectable()
export class FallbackGlspLayoutConfigurator extends GlspLayoutConfigurator {
    protected fallbackGraphOptions: LayoutOptions;
    constructor(protected typeMapper: BasicTypeMapper, algorithms: string[], defaultLayoutOptions: LayoutOptions = {}) {
        super();
        this.fallbackGraphOptions = {
            'elk.algorithm': algorithms[0],
            ...defaultLayoutOptions
        };
    }

    protected graphOptions(sgraph: SGraph, index: SModelIndex): LayoutOptions | undefined {
        return this.fallbackGraphOptions;
    }
}
