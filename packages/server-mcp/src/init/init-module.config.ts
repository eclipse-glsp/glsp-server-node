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

import { ClientSessionInitializer } from '@eclipse-glsp/server';
import { ContainerModule } from 'inversify';
import { ExportMcpPngActionHandlerInitContribution } from './export-png-action-handler-contribution';

// TODO this only exists to inject additional action handlers without interfering too much with the given module hierarchy
// however, as this is somewhat hacky, it is likely better to just extend `ServerModule` (e.g., `McpServerModule`) to register the handlers
// it could even be completely unnecessary if all the action handlers registered are for useless features that are removed anyway
export function configureMcpInitModule(): ContainerModule {
    return new ContainerModule(bind => {
        bind(ExportMcpPngActionHandlerInitContribution).toSelf().inSingletonScope();
        bind(ClientSessionInitializer).toService(ExportMcpPngActionHandlerInitContribution);
    });
}
