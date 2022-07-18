/********************************************************************************
 * Copyright (c) 2019-2022 EclipseSource and others.
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
import {
    ApplicationIdProvider,
    BaseJsonrpcGLSPClient,
    configureServerActions,
    EnableToolPaletteAction,
    GLSPClient,
    GLSPDiagramServer,
    IActionDispatcher,
    RequestModelAction,
    RequestTypeHintsAction,
    TYPES
} from '@eclipse-glsp/client';
import { BrowserMessageReader, BrowserMessageWriter, createMessageConnection } from 'vscode-jsonrpc/browser';
import { ConsoleLogger } from 'vscode-ws-jsonrpc';
import createContainer from './di.config';
export const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed';

const id = 'workflow';
const diagramType = 'workflow-diagram';

const examplePath = 'mock://example1.wf';
const clientId = ApplicationIdProvider.get() + '_' + examplePath;

const container = createContainer();
const diagramServer = container.get<GLSPDiagramServer>(TYPES.ModelSource);
diagramServer.clientId = clientId;

const serverWorker = new Worker(
    new URL(
        './worker/server',
        // @ts-expect-error (TS1343)
        // We compile to CommonJS but `import.meta` is still available in the brows
        import.meta.url
    )
);
serverWorker.addEventListener(
    'message',
    message => {
        if (message.data === START_UP_COMPLETE_MSG) {
            initialize();
        } else {
            throw new Error(`Unexpected message received: ${message.data}`);
        }
    },
    { once: true }
);

async function initialize(): Promise<void> {
    console.log('Initialize');
    const connection = createMessageConnection(
        new BrowserMessageReader(serverWorker),
        new BrowserMessageWriter(serverWorker),
        new ConsoleLogger()
    );

    const client = new BaseJsonrpcGLSPClient({ id, connectionProvider: connection });

    await diagramServer.connect(client);
    const result = await client.initializeServer({
        applicationId: ApplicationIdProvider.get(),
        protocolVersion: GLSPClient.protocolVersion
    });
    await configureServerActions(result, diagramType, container);

    const actionDispatcher = container.get<IActionDispatcher>(TYPES.IActionDispatcher);

    await client.initializeClientSession({ clientSessionId: diagramServer.clientId, diagramType });
    actionDispatcher.dispatch(
        RequestModelAction.create({
            options: {
                sourceUri: `${examplePath}`,
                diagramType
            }
        })
    );
    actionDispatcher.dispatch(RequestTypeHintsAction.create());
    actionDispatcher.dispatch(EnableToolPaletteAction.create());
}
