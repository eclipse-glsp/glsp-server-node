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
import { GLSPServer } from './glsp-server';

export const GLSPServerListener = Symbol('GLSPServerListener');

/**
 * A listener to track the connection status of {@link GLSPClient}s (i.e. client applications).
 * Gets notified when a new GLSP client connects or disconnects.
 */
export interface GLSPServerListener {
    /**
     * Triggered after a GLSPServer has been initialized via the {@link GLSPServer.initialize()}
     * method.
     *
     * @param server The GLSPServer which has been initialized.
     */
    serverInitialized?(server: GLSPServer): void;

    /**
     * Triggered after the {@link GLSPServer.shutdown()} method has been invoked.
     *
     * @param glspServer The glspServer which has been shut down.
     */
    serverShutDown?(server: GLSPServer): void;
}
