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

@injectable()
export abstract class Logger {
    abstract logLevel: LogLevel;

    abstract caller?: string;

    abstract info(message: string, ...params: any[]): void;

    abstract warn(message: string, ...params: any[]): void;

    abstract error(message: string, ...params: any[]): void;

    abstract debug(message: string, ...params: any[]): void;
}

export class NullLogger extends Logger {
    logLevel: LogLevel;
    caller?: string | undefined;
    info(message: string, ...params: any[]): void {
        // no-op
    }
    warn(message: string, ...params: any[]): void {
        // no-op
    }
    error(message: string, ...params: any[]): void {
        // no-op
    }
    debug(message: string, ...params: any[]): void {
        // no-op
    }
}

export const LoggerFactory = Symbol('LoggerFactory');

export type LoggerFactory = (caller: string) => Logger;

export enum LogLevel {
    none = 0,
    error = 1,
    warn = 2,
    info = 3,
    debug = 4
}

export function asLogLevel(level: string | number): LogLevel | undefined {
    let levelKey = level;
    if (typeof levelKey === 'string') {
        levelKey = levelKey.toLowerCase();
    }

    if (levelKey in LogLevel) {
        return (LogLevel as any)[level];
    }
    return undefined;
}
