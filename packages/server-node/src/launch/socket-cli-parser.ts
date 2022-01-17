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
import * as cmd from 'commander';
import { CliParser, createCliParser, defaultLaunchOptions, LaunchOptions } from './cli-parser';

export interface SocketLaunchOptions extends LaunchOptions {
    port: number;
    host: string;
}

export const defaultSocketLaunchOptions: Required<SocketLaunchOptions> = {
    ...defaultLaunchOptions,
    port: 5007,
    host: 'localhost'
};

export function createSocketCliParser<O extends SocketLaunchOptions = SocketLaunchOptions>(
    defaultOptions: SocketLaunchOptions = defaultSocketLaunchOptions
): CliParser<O> {
    const parser = createCliParser<O>(defaultOptions);
    parser.command
        .option('-p , --port <port>', `Set server port [default= ${defaultOptions.port}]`, processPort, defaultOptions.port)
        .option('--host <host>', `Set host name [default= ${defaultOptions.host}`, defaultOptions.host)
        .option('--no-consoleLog', 'Disable console logging')
        .option('--fileLog', 'Enable file logging', defaultOptions.fileLog);
    return parser;
}

export function processPort(value: string): number {
    const port = Number.parseInt(value, 10);
    if (isNaN(port)) {
        throw new cmd.InvalidArgumentError('Port is not a number!');
    }
    if (port < 0 || port > 65535) {
        throw new cmd.InvalidArgumentError('Port has to be between in range (0,65535)!');
    }

    return port;
}
