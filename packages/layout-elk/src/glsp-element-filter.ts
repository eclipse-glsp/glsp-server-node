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
import { inject, injectable } from 'inversify';
import { DefaultElementFilter } from 'sprotty-elk';
import { SModelElement } from 'sprotty-protocol';
import { BasicTypeMapper } from './basic-type-mapper';

/**
 * The default `IElementFilter` used to determine which model elements should be included in the automatic layout.
 * Without further configuration this filter includes all basic model elements (nodes,edges,labels,ports) that are
 * part of the graphical model. For each a custom filter behavior is in place. Edges that have no source or target are filtered out.
 * In addition, edges that are connected to a filtered element are filtered out as well.
 * The filter behavior for each of the basic types can be customized by overriding the corresponding `filter` method.
 * (e.g. {@link GlspElementFilter.filterNode})
 *
 */
@injectable()
export class GlspElementFilter extends DefaultElementFilter {
    @inject(BasicTypeMapper)
    protected typeMapper: BasicTypeMapper;

    protected getBasicType(smodel: SModelElement): string {
        return this.typeMapper.getBasicType(smodel);
    }
}
