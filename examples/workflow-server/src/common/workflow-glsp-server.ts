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
import { Args, ArgsUtil, DefaultGLSPServer, InitializeResult, Logger, MaybePromise } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';

@injectable()
export class WorkflowGLSPServer extends DefaultGLSPServer {
    MESSAGE_KEY = 'message';
    TIMESTAMP_KEY = 'timestamp';

    @inject(Logger)
    protected override logger: Logger;

    protected override handleInitializeArgs(result: InitializeResult, args: Args | undefined): MaybePromise<InitializeResult> {
        if (!args) {
            return result;
        }
        const timestamp = ArgsUtil.get(args, this.TIMESTAMP_KEY);
        const message = ArgsUtil.get(args, this.MESSAGE_KEY);

        this.logger.debug(`${timestamp}: ${message}`);
        return result;
    }
}
