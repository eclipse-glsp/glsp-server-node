/********************************************************************************
 * Copyright (c) 2018-2022 TypeFox and others.
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
import { GEdge, GLabel, GModelElement, GNode, GPort, ModelState } from '@eclipse-glsp/server-node';
import { inject, injectable } from 'inversify';

export const ElementFilter = Symbol('ElementFilter');
/**
 * Filter used to determine which model elements should be included in the automatic layout.
 */
export interface ElementFilter {
    /**
     * Applies the element filter on the given element,
     * @param element The element on which the filter should be applied.
     * @returns `true` if the element should be included in the automatic layout, `false` otherwise.
     */
    apply(element: GModelElement): boolean;
}

/**
 * Default implementation of {@link ElementFilter}.
 * Without further configuration this filter includes all basic model elements (nodes,edges,labels,ports) that are
 * part of the graphical model. For each basic type a custom filter behavior is in place.
 * Edges that have no source or target are filtered out. In addition, edges that are connected to a filtered element are filtered out
 * as well. The filter behavior for each of the basic types can be customized by overriding the corresponding `filter` method.
 * (e.g. {@link DefaultElementFilter.filterNode})
 */
@injectable()
export class DefaultElementFilter implements ElementFilter {
    @inject(ModelState)
    protected modelState: ModelState;

    apply(element: GModelElement): boolean {
        if (element instanceof GNode) {
            return this.filterNode(element);
        } else if (element instanceof GEdge) {
            return this.filterEdge(element);
        } else if (element instanceof GLabel) {
            this.filterLabel(element);
        } else if (element instanceof GPort) {
            this.filterPort(element);
        }
        return true;
    }

    protected filterNode(node: GNode): boolean {
        return true;
    }

    protected filterEdge(edge: GEdge): boolean {
        const source = this.modelState.index.get(edge.sourceId);

        if (!source || (source instanceof GNode && !this.filterNode(source)) || (source instanceof GPort && !this.filterPort(source))) {
            return false;
        }

        const target = this.modelState.index.get(edge.targetId);

        if (!target || (target instanceof GNode && !this.filterNode(target)) || (target instanceof GPort && !this.filterPort(target))) {
            return false;
        }
        return true;
    }

    protected filterLabel(label: GLabel): boolean {
        return true;
    }

    protected filterPort(port: GPort): boolean {
        return true;
    }
}
