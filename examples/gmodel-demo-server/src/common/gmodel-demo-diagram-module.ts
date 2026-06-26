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
import { BindingTarget, DiagramConfiguration, GModelDiagramModule, SourceModelStorage } from '@eclipse-glsp/server';
import { injectable } from 'inversify';
import { GModelDemoDiagramConfiguration } from './gmodel-demo-diagram-configuration';

/**
 * Minimal {@link GModelDiagramModule} for the `gmodel-demo` example language.
 *
 * The configuration is essentially the default type mapping plus default type
 * hints. Persistence reuses the extension-agnostic `GModelStorage`/`GModelSerializer`
 * provided by the consumer via {@link bindSourceModelStorage}, so no new persistence
 * code is needed. No custom operation handlers are bound — the language is
 * load-and-interact only.
 */
@injectable()
export class GModelDemoDiagramModule extends GModelDiagramModule {
    constructor(public bindSourceModelStorage: () => BindingTarget<SourceModelStorage>) {
        super();
    }

    get diagramType(): string {
        return 'gmodel-demo';
    }

    protected bindDiagramConfiguration(): BindingTarget<DiagramConfiguration> {
        return GModelDemoDiagramConfiguration;
    }
}
