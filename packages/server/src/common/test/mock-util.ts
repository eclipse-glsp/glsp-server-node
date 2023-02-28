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
/* eslint-disable @typescript-eslint/no-empty-function */
// Stub-implementation classes used for unit testing

import { GEdge, GModelElement, GModelElementConstructor, GNode } from '@eclipse-glsp/graph';
import {
    Action,
    ActionMessage,
    Args,
    CreateNodeOperation,
    EdgeTypeHint,
    InitializeClientSessionParameters,
    MaybeArray,
    MaybePromise,
    Point,
    RequestEditValidationAction,
    ShapeTypeHint,
    ValidationStatus
} from '@eclipse-glsp/protocol';
import { expect } from 'chai';
import { Container } from 'inversify';
import { MessageConnection } from 'vscode-jsonrpc';
import { ActionDispatcher } from '../actions/action-dispatcher';
import { ActionHandler, ActionHandlerFactory } from '../actions/action-handler';
import { Command } from '../command/command';
import { DiagramConfiguration, ServerLayoutKind } from '../diagram/diagram-configuration';
import { ContextEditValidator } from '../features/directediting/context-edit-validator';
import { LabelEditValidator } from '../features/directediting/label-edit-validator';
import { GModelCreateEdgeOperationHandler, GModelCreateNodeOperationHandler } from '../gmodel/index';
import { JsonRpcGLSPClientProxy } from '../protocol/glsp-client-proxy';
import { GLSPServer } from '../protocol/glsp-server';
import { GLSPServerListener } from '../protocol/glsp-server-listener';
import { ClientSession } from '../session/client-session';
import { ClientSessionFactory } from '../session/client-session-factory';
import { ClientSessionInitializer } from '../session/client-session-initializer';
import { ClientSessionListener } from '../session/client-session-listener';
import { ClientSessionManager } from '../session/client-session-manager';
import { Logger, LogLevel } from '../utils/logger';

export async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Consumes a maybe async function and checks for error
 * @param  method - The function to check
 * @param  message - Optional message to match with error message
 */
export async function expectToThrowAsync(toEvaluate: () => MaybePromise<void>, message?: string): Promise<void> {
    let err: Error | undefined = undefined;
    try {
        await toEvaluate();
    } catch (error: any) {
        err = error;
    }
    if (message) {
        expect(err?.message).to.be.equal(message);
    } else {
        expect(err).to.be.an('Error');
    }
}

export function createClientSession(
    id: string,
    diagramType: string,
    container = new Container(),
    actionDispatcher = new StubActionDispatcher()
): ClientSession {
    return {
        id,
        diagramType,
        container,
        actionDispatcher,
        dispose: () => {
            //
        }
    };
}

export class StubActionHandler implements ActionHandler {
    constructor(public actionKinds: string[]) {}

    execute(action: Action): Action[] {
        return [];
    }
}

export class StubCreateNodeOperationHandler extends GModelCreateNodeOperationHandler {
    elementTypeIds: string[];

    constructor(readonly label: string) {
        super();
        this.elementTypeIds = [label];
    }

    createNode(operation: CreateNodeOperation, relativeLocation?: Point): GNode | undefined {
        return new GNode();
    }
}

export class StubCreateEdgeOperationHandler extends GModelCreateEdgeOperationHandler {
    elementTypeIds: string[];

    constructor(readonly label: string) {
        super();
        this.elementTypeIds = [label];
    }

    createEdge(source: GModelElement, target: GModelElement): GEdge | undefined {
        return undefined;
    }
}

export class StubActionDispatcher implements ActionDispatcher {
    dispatchAfterNextUpdate(...actions: MaybeArray<Action[]>): void {}

    dispatch(action: Action): Promise<void> {
        return Promise.resolve();
    }

    dispatchAll(...actions: MaybeArray<Action>[]): Promise<void> {
        return Promise.resolve();
    }
}

export class StubClientSessionFactory implements ClientSessionFactory {
    create(params: InitializeClientSessionParameters): ClientSession {
        const { clientSessionId, diagramType } = params;
        return createClientSession(clientSessionId, diagramType);
    }
}

export class StubClientSessionManager implements ClientSessionManager {
    getOrCreateClientSession(params: InitializeClientSessionParameters): ClientSession {
        const { clientSessionId, diagramType } = params;
        return createClientSession(clientSessionId, diagramType);
    }

    getSession(clientSessionId: string): ClientSession | undefined {
        return undefined;
    }

    getSessionsByType(diagramType: string): ClientSession[] {
        return [];
    }

    disposeClientSession(clientSessionId: string): boolean {
        return true;
    }

    addListener(listener: ClientSessionListener, ...clientSessionIds: string[]): boolean {
        return true;
    }

    removeListener(listener: ClientSessionListener): boolean {
        return true;
    }

    removeListeners(...clientSessionIds: string[]): void {
        return undefined;
    }
}

export class StubLogger extends Logger {
    logLevel = LogLevel.none;
    caller = undefined;

    info(message: string, ...params: any[]): void {}

    warn(message: string, ...params: any[]): void {}

    error(message: string, ...params: any[]): void {}

    debug(message: string, ...params: any[]): void {}
}

export class StubClientSessionListener implements ClientSessionListener {
    sessionCreated(clientSession: ClientSession): void {}

    sessionDisposed(clientSession: ClientSession): void {}
}

export class StubGLSPClientProxy implements JsonRpcGLSPClientProxy {
    connect(connection: MessageConnection): void {}

    process(message: ActionMessage<Action>): void {}
}

export class StubGLSPServerListener implements GLSPServerListener {
    serverInitialized(server: GLSPServer): void {}

    serverShutDown(server: GLSPServer): void {}
}

export class StubDiagramConfiguration implements DiagramConfiguration {
    typeMapping = new Map<string, GModelElementConstructor>();

    shapeTypeHints: ShapeTypeHint[] = [];

    edgeTypeHints: EdgeTypeHint[] = [];

    layoutKind = ServerLayoutKind.NONE;

    needsClientLayout = true;

    animatedUpdate = true;
}

export class TestLabelEditValidator extends LabelEditValidator {
    validate(label: string, element: GModelElement): ValidationStatus {
        if (label === 'error') {
            return { severity: ValidationStatus.Severity.ERROR, message: 'error' };
        }
        if (label === 'warning') {
            return { severity: ValidationStatus.Severity.WARNING, message: 'warning' };
        }
        return { severity: ValidationStatus.Severity.OK, message: 'ok' };
    }
}

export class TestContextEditValidator implements ContextEditValidator {
    get contextId(): string {
        return 'test';
    }

    validate(action: RequestEditValidationAction): ValidationStatus {
        if (action.text === 'error') {
            return { severity: ValidationStatus.Severity.ERROR, message: 'error' };
        }
        if (action.text === 'warning') {
            return { severity: ValidationStatus.Severity.WARNING, message: 'warning' };
        }
        return { severity: ValidationStatus.Severity.OK, message: 'ok' };
    }
}

export const stubActionHandlerFactory: ActionHandlerFactory = constructor => new constructor();

export class StubClientSessionInitializer implements ClientSessionInitializer {
    initialize(args?: Args): void {}
}

export class StubCommand implements Command {
    execute(): void {}
    undo(): void {}
    redo(): void {}
    canUndo?(): boolean;
}
