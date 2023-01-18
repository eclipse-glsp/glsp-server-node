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
import { InitializeClientSessionParameters, remove } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { GLSPServer } from '../protocol/glsp-server';
import { GLSPServerListener } from '../protocol/glsp-server-listener';
import { GLSPServerError } from '../utils/glsp-server-error';
import { ClientSession } from './client-session';
import { ClientSessionFactory } from './client-session-factory';
import { ClientSessionListener } from './client-session-listener';

export const ClientSessionManager = Symbol('ClientSessionManager');

/**
 * The central component that manages the lifecycle of client sessions.
 */
export interface ClientSessionManager {
    /**
     * Retries an existing (or created a new) {@link ClientSession} for the given id and diagram type.
     * If a new session has been created all {@link ClientSessionListener}s are notified via the
     * {@link ClientSessionListener.sessionCreated} method.
     *
     * @param clientSessionId The client session id (i.e. clientId).
     * @param diagramType     The diagram type.
     * @returns The existing or newly constructed {@link ClientSession}.
     *
     * @throws {@link GLSPServerError} if another session with matching client id but different diagram type already exists.
     */
    getOrCreateClientSession(params: InitializeClientSessionParameters): ClientSession;

    /**
     * Retrieve an existing (i.e. currently active) {@link ClientSession} for the given client session id.
     *
     * @param clientSessionId The client session id.
     * @returns The client session for the given id o `undefined` if no session is present with the given id.
     */
    getSession(clientSessionId: string): ClientSession | undefined;

    /**
     * Return all currently active {@link ClientSession}s for the given diagram type.
     *
     * @param diagramType The diagram type.
     * @returns An array of all currently active {@link ClientSession}s.
     */
    getSessionsByType(diagramType: string): Array<ClientSession>;

    /**
     * Dispose the active client session with the given id. This marks the end of the lifecylce of a client session.
     * After successfully disposal all {@link ClientSessionListener}s are notified via the
     * {@link ClientSessionListener.sessionDisposed} method.
     *
     * @param clientSessionId The id of the client session which should be disposed.
     * @returns `true` if a session with the given id was active and successfully disposed, `false` otherwise.
     */
    disposeClientSession(clientSessionId: string): boolean;

    /**
     * Register a new {@link ClientSessionListener}. Optionally the scope of the listener can be restricted to a set
     * of client session ids. If no client session ids are passed, the listener will be registered globally and trigger
     * for all client sessions.
     *
     * @param listener         The listener that should be registered.
     * @param clientSessionIds Scope of client ids
     * @returns `true` if the listener was registered successfully, `false` otherwise
     */
    addListener(listener: ClientSessionListener, ...clientSessionIds: string[]): boolean;

    /**
     * Unregister a given {@link ClientSessionListener} from this client session manager.
     *
     * @param listener The listener that should be removed.
     * @returns `false` if the listener is not registered, `true` if it was successfully unregistered.
     */
    removeListener(listener: ClientSessionListener): boolean;

    /**
     * Unregister all {@link ClientSessionListener} that haven been registered for the given scope of client session ids.
     * If not client session ids are passed all listeners will be removed.
     *
     * @param clientSessionIds Scope (i.e. set) of client session ids.
     */
    removeListeners(...clientSessionIds: string[]): void;
}

const ALL_CLIENT_IDS_KEY = '*';

@injectable()
export class DefaultClientSessionManager implements ClientSessionManager, GLSPServerListener {
    @inject(ClientSessionFactory) sessionFactory: ClientSessionFactory;

    protected clientSessions: Map<string, ClientSession> = new Map<string, ClientSession>();
    protected listeners: Map<string, ClientSessionListener[]> = new Map<string, ClientSessionListener[]>();

    protected getListenersToNotify(clientSession: ClientSession, method: keyof ClientSessionListener): ClientSessionListener[] {
        const globalListeners = this.listeners.get(ALL_CLIENT_IDS_KEY)?.filter(listener => listener[method]) ?? [];
        const sessionListeners = this.listeners.get(clientSession.id)?.filter(listener => listener[method]) ?? [];
        return [...globalListeners, ...sessionListeners];
    }

    getOrCreateClientSession(params: InitializeClientSessionParameters): ClientSession {
        const { clientSessionId, diagramType } = params;
        const session = this.clientSessions.get(clientSessionId);
        if (session) {
            if (session.diagramType !== diagramType) {
                throw new GLSPServerError(`Could not initialize new session for diagram type '${diagramType}'
                Another session with the same id for the diagram type ${session.diagramType} already exists`);
            }
            return session;
        }

        const newSession = this.sessionFactory.create(params);
        this.clientSessions.set(clientSessionId, newSession);
        this.getListenersToNotify(newSession, 'sessionCreated').forEach(listener => listener.sessionCreated!(newSession));
        return newSession;
    }

    getSession(clientSessionId: string): ClientSession | undefined {
        return this.clientSessions.get(clientSessionId);
    }

    getSessionsByType(diagramType: string): ClientSession[] {
        return Array.from(this.clientSessions.values()).filter(session => session.diagramType === diagramType);
    }

    disposeClientSession(clientSessionId: string): boolean {
        const session = this.clientSessions.get(clientSessionId);
        if (session) {
            session.dispose();
            this.getListenersToNotify(session, 'sessionDisposed').forEach(listener => listener.sessionDisposed!(session));
            this.clientSessions.delete(clientSessionId);
            this.listeners.delete(clientSessionId);
            return true;
        }
        return false;
    }

    addListener(listener: ClientSessionListener, ...clientSessionIds: string[]): boolean {
        if (clientSessionIds.length === 0) {
            this.addSingleListener(ALL_CLIENT_IDS_KEY, listener);
        }
        return clientSessionIds.map(clientId => this.addSingleListener(clientId, listener)).every(added => added);
    }

    protected addSingleListener(clientSessionId: string, listener: ClientSessionListener): boolean {
        const listeners = this.listeners.get(clientSessionId) ?? [];
        listeners.push(listener);
        this.listeners.set(clientSessionId, listeners);
        return true;
    }

    removeListener(listener: ClientSessionListener): boolean {
        return Array.from(this.listeners.values())
            .map(listeners => remove(listeners, listener))
            .every(removed => removed);
    }

    removeListeners(...clientSessionIds: string[]): void {
        if (clientSessionIds.length === 0) {
            this.listeners.clear();
        } else {
            clientSessionIds.forEach(id => this.listeners.delete(id));
        }
    }

    serverShutDown(server: GLSPServer): void {
        Array.from(this.clientSessions.keys()).forEach(id => this.disposeClientSession(id));
        this.listeners.clear();
    }
}
