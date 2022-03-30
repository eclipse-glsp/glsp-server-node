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
import * as winston from 'winston';
import { asLogLevel, Logger, LogLevel } from './logger';

export class WinstonLogger extends Logger {
    constructor(protected baseLogger: winston.Logger, public caller?: string) {
        super();
    }

    info(message: string, ...params: any): void {
        if (this.logLevel !== LogLevel.none) {
            this.baseLogger.info(this.combinedMessage(message, ...params));
        }
    }

    warn(message: string, ...params: any[]): void {
        if (this.logLevel !== LogLevel.none) {
            this.baseLogger.warn(this.combinedMessage(message, ...params));
        }
    }

    error(message: string, ...params: any[]): void {
        if (this.logLevel !== LogLevel.none) {
            this.baseLogger.error(this.combinedMessage(message, ...params));
        }
    }

    debug(message: string, ...params: any[]): void {
        if (this.logLevel !== LogLevel.none) {
            this.baseLogger.debug(this.combinedMessage(message, ...params));
        }
    }

    get logLevel(): LogLevel {
        return asLogLevel(this.baseLogger.level) || LogLevel.none;
    }

    set logLevel(level: LogLevel) {
        this.baseLogger.level = LogLevel[level];
    }

    combinedMessage(message: string, ...params: any[]): string {
        const caller = this.caller ? `[${this.caller}]` : '';
        const additional = this.logAdditionals(...params);
        return `${caller} ${message} ${additional}`;
    }

    logAdditionals(...params: any[]): string {
        if (!params || params.length === 0) {
            return '';
        }
        return params.map(param => this.toString(param)).join(',\n');
    }

    override toString(param: unknown): string {
        if (param instanceof Error) {
            return `${param.message}
            ${param.stack || ''}`;
        }
        return JSON.stringify(param, undefined, 4);
    }
}
