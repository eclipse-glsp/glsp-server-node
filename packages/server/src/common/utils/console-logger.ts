/********************************************************************************
 * Copyright (c) 2022-2025 EclipseSource and others.
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

import { BindingContext } from '@eclipse-glsp/protocol/lib/di';
import { injectable } from 'inversify';
import { LogLevel, Logger, LoggerConfigOptions, LoggerFactory, NullLogger, asLogLevel, getRequestParentName } from './logger';

/**
 *  Simple logger implementation that forwards logging calls to the `console` and
 *  can be used in both the browser and node context.
 */
@injectable()
export class ConsoleLogger extends Logger {
    constructor(
        public logLevel: LogLevel = LogLevel.none,
        public caller?: string
    ) {
        super();
    }

    info(message: string, ...params: any[]): void {
        if (LogLevel.info <= this.logLevel) {
            console.info(this.logMessage(LogLevel.info, message, ...params));
        }
    }

    warn(message: string, ...params: any[]): void {
        if (LogLevel.warn <= this.logLevel) {
            console.warn(this.logMessage(LogLevel.warn, message, ...params));
        }
    }

    error(message: string, ...params: any[]): void {
        if (LogLevel.error <= this.logLevel) {
            console.error(this.logMessage(LogLevel.error, message, ...params));
        }
    }

    debug(message: string, ...params: any[]): void {
        if (LogLevel.debug <= this.logLevel) {
            console.debug(this.logMessage(LogLevel.debug, message, ...params));
        }
    }

    logMessage(level: LogLevel, message: string, ...params: any[]): string {
        return `${this.logTimestamp()} ${asLogLevel(level)} - ${this.logCaller()} ${message} ${this.logAdditionals(...params)}`;
    }

    protected logCaller(): string {
        return this.caller ? `[${this.caller}]` : '';
    }

    protected logTimestamp(): string {
        return new Date().toLocaleTimeString();
    }

    logAdditionals(...params: any[]): string {
        return !params || params.length === 0 ? '' : params.map(param => this.stringify(param)).join(this.logAdditionalsSeparator());
    }

    protected logAdditionalsSeparator(): string {
        return ',\n';
    }

    stringify(param: unknown): string {
        return param instanceof Error ? this.stringifyError(param) : JSON.stringify(param, undefined, 4);
    }

    protected stringifyError(error: Error): string {
        return `${error.message}
        ${error.stack || ''}`;
    }
}

export function configureConsoleLogger<T extends LoggerConfigOptions>(context: BindingContext, options: T): void {
    if (!options.consoleLog) {
        context.bind(Logger).to(NullLogger).inSingletonScope();
    } else {
        context.bind(Logger).toDynamicValue(ctx => new ConsoleLogger(options.logLevel, getRequestParentName(ctx)));
    }
    context.bind(LoggerFactory).toFactory(dynamicContext => (caller: string) => {
        const logger = dynamicContext.container.get(Logger);
        logger.caller = caller;
        return logger;
    });
}
