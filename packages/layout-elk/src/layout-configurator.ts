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
import { GEdge, GGraph, GLabel, GModelElement, GNode, GPort, ModelState } from '@eclipse-glsp/server';
import { LayoutOptions } from 'elkjs';
import { inject, injectable } from 'inversify';
export const LayoutConfigurator = Symbol('LayoutConfigurator');
/**
 * Configurator for ELK layout algorithms; provides mappings of layout options for each model element.
 * For a list of all available layout options checkout the official ELK documentation:
 * {@link https://www.eclipse.org/elk/reference/options.html}
 */
export interface LayoutConfigurator {
    /**
     * Computes the {@link LayoutOptions} for the given {@link GModelElement}.
     * @param element The element for which the layout options should be computed.
     * @returns The set of layout options for the given element or `undefined`.
     */
    apply(element: GModelElement): LayoutOptions | undefined;
}

/**
 * Abstract default implementation of {@link LayoutConfigurator}.
 * A minimal configuration should at least specify the `elk.algorithm` option as
 * return value of {@link DefaultLayoutConfigurator.graphOptions}.
 */
@injectable()
export abstract class AbstractLayoutConfigurator implements LayoutConfigurator {
    @inject(ModelState)
    protected modelState: ModelState;

    apply(element: GModelElement): LayoutOptions | undefined {
        if (element instanceof GGraph) {
            return this.graphOptions(element);
        } else if (element instanceof GNode) {
            return this.nodeOptions(element);
        } else if (element instanceof GEdge) {
            return this.edgeOptions(element);
        } else if (element instanceof GLabel) {
            this.labelOptions(element);
        } else if (element instanceof GPort) {
            this.portOptions(element);
        }
        return undefined;
    }

    protected graphOptions(graph: GGraph): LayoutOptions | undefined {
        return undefined;
    }

    protected nodeOptions(node: GNode): LayoutOptions | undefined {
        return undefined;
    }

    protected edgeOptions(edge: GEdge): LayoutOptions | undefined {
        return undefined;
    }

    protected labelOptions(label: GLabel): LayoutOptions | undefined {
        return undefined;
    }

    protected portOptions(sport: GPort): LayoutOptions | undefined {
        return undefined;
    }
}

/**
 * A fallback configurator that is used in the `configureELKLayoutModule` utility method.
 * If no explicit layout configurator binding is provided a new instance of the fallback configurator is
 * bound as replacement. Basic layout options for the root graph element are derived from the
 * configuration parameters that haven been passed to the `configureELKLayoutModule` function.
 */
@injectable()
export class FallbackLayoutConfigurator extends AbstractLayoutConfigurator {
    protected fallbackGraphOptions: LayoutOptions;
    constructor(algorithms: string[], defaultLayoutOptions: LayoutOptions = {}) {
        super();
        this.fallbackGraphOptions = {
            'elk.algorithm': algorithms[0],
            ...defaultLayoutOptions
        };
    }

    protected override graphOptions(sgraph: GGraph): LayoutOptions | undefined {
        return this.fallbackGraphOptions;
    }
}
