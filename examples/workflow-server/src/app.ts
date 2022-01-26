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
import { configureELKLayoutModule } from '@eclipse-glsp/layout-elk';
import { createAppModule, createSocketCliParser, LoggerFactory, resolveAndCatch, SocketServerLauncher } from '@eclipse-glsp/server-node';
import { Container } from 'inversify';
import { WorkflowLayoutConfigurator } from './layout/workflow-layout-configurator';
import { WorkflowDiagramModule, WorkflowServerModule } from './workflow-diagram-module';

export function launch(argv?: string[]): void {
    const options = createSocketCliParser().parse(argv);
    const appContainer = new Container();
    appContainer.load(createAppModule(options));

    const logger = appContainer.get<LoggerFactory>(LoggerFactory)('WorkflowServerApp');
    const launcher = appContainer.resolve(SocketServerLauncher);
    const elkLayoutModule = configureELKLayoutModule({ algorithms: ['layered'], layoutConfigurator: WorkflowLayoutConfigurator });
    const serverModule = new WorkflowServerModule().configureDiagramModule(new WorkflowDiagramModule(), elkLayoutModule);

    const errorHandler = (error: any): void => logger.error('Error in workflow server launcher:', error);
    launcher.configure(serverModule);
    resolveAndCatch(() => launcher.start({ port: options.port, host: options.host }), errorHandler);
}
