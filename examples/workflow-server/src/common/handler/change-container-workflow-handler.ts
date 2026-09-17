/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import { ChangeContainerOperation, GCompartment, GModelChangeContainerOperationHandler, GModelElement } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import { Category } from '../graph-extension';
import { ModelTypes } from '../util/model-types';

/**
 * Workflow-specific {@link GModelChangeContainerOperationHandler} that redirects reparenting into a
 * {@link Category}'s structure compartment. The client references the outer {@link Category} node as
 * container, so the actual child container (the `struct` compartment) has to be resolved on the server side.
 */
@injectable()
export class ChangeContainerWorkflowHandler extends GModelChangeContainerOperationHandler {
    override getContainer(operation: ChangeContainerOperation): GModelElement | undefined {
        const container = super.getContainer(operation);
        if (container instanceof Category) {
            const structComp = this.getCategoryCompartment(container);
            if (structComp) {
                return structComp;
            }
        }
        return container;
    }

    getCategoryCompartment(category: Category): GCompartment | undefined {
        return category.children
            .filter(child => child instanceof GCompartment)
            .map(child => child as GCompartment)
            .find(comp => ModelTypes.STRUCTURE === comp.type);
    }
}
