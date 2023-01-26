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
import { injectable } from 'inversify';

export const GModelFactory = Symbol('GModelFactory');

/**
 * A graph model factory produces a graph model from the model state; typically its contained source model.
 *
 * The responsibility of a {@link GModelFactory} implementation is to define how a {@link ModelState} is to be
 * translated into a {@link GModelRoot} that is sent to the client for rendering. Before a {@link GModelFactory}
 * is invoked, the {@link SourceModelStorage} has already been executed for loading the source model into the
 * {@link ModelState}. The {@link GModelFactory} then produces the {@link GModelRoot} from the source model in the
 * {@link ModelState}. Implementations of {@link GModelFactory} are usually specific to the type of source model, as
 * they need to understand the source model in order to translate it into a graph model.
 *
 * The graph model factory is invoked after initial load of the source model and after each operation that is applied
 * to the source model by an {@link OperationHandler} in order to update the graph model before sending it to the client
 * for rendering.
 *
 * If an index is needed for mapping between the graph model and the source model, as is typically the case for
 * {@link ActionHandler action handlers} and {@link OperationHandler operation handlers}, it is the responsibility of
 * the graph model factory to create such an index while producing the graph model from the source model. The index
 * shall be put into the model state too. Typically the {@link GModelIndex} is extended for a particular model source
 * type as well.
 *
 * @see SourceModelStorage
 * @see GModelIndex
 */
export interface GModelFactory {
    /**
     * Create a {@link GModelRoot} from the specified <code>modelState</code> and puts it into the
     * <code>modelState</code>. Optionally, this step also produces and sets a {@link GModelIndex} in the model state
     * that allows mapping from graph model elements to source model elements and vice versa.
     */
    createModel(): void;
}

/**
 * GModelFactory to be used if the graph model is already available from the model source.
 */
@injectable()
export class GModelFactoryNullImpl implements GModelFactory {
    createModel(): void {
        // no-op
    }
}
