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
import { ContainerModule, interfaces } from 'inversify';
import * as winston from 'winston';
import { LaunchOptions } from '../launch/cli-parser';
import { Logger, LoggerFactory, LogLevel } from '../utils/logger';
import { WinstonLogger } from '../utils/winston-logger';
import { ModuleContext } from './glsp-module';
import { InjectionContainer } from './service-identifiers';

export function createAppModule(options: LaunchOptions): ContainerModule {
    return new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(InjectionContainer).toDynamicValue(dynamicContext => dynamicContext.container);
        const context = { bind, unbind, isBound, rebind };
        configureWinstonLogger(context, options);
    });
}

/**
 * Creates the global {@link winston.Logger} instance is used internally by all instances of {@link WinstonLogger}. Can be configured with
 * the given {@link LaunchOptions}.
 * @param options The {@link LaunchOptions}
 * @returns the configured winston instance.
 */
export function createWinstonInstance<T extends LaunchOptions>(options: T): winston.Logger {
    const level = LogLevel[options.logLevel];
    const transports: winston.transport[] = [];

    const printf = winston.format.printf(({ level, message, timestamp }) => `${timestamp} ${level} -  ${message}`);
    const timestamp = winston.format.timestamp({ format: () => new Date().toLocaleTimeString() });

    const consoleLogFormat = winston.format.combine(winston.format.colorize(), timestamp, printf);
    const fileLogFormat = winston.format.combine(timestamp, printf);

    if (options.consoleLog) {
        transports.push(new winston.transports.Console({ format: consoleLogFormat }));
    }

    if (options.fileLog) {
        const date = new Date();
        const dateString = `${date.getDate()}-${
            date.getMonth() + 1
        }-${date.getFullYear()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;

        const filename = `GLSP-Server_${dateString}.log`;
        transports.push(new winston.transports.File({ dirname: options.logDir, filename, format: fileLogFormat }));
    }

    return winston.createLogger({ level, transports });
}

/**
 * Configures the binding for {@link WinstonLogger} in the given {@link ModuleContext} with the given {@link LaunchOptions}.
 * @param context The module context.
 * @param options The launch options.
 * @param rebind Flag to determine wether an existing {@link Logger} binding in the context should be rebound. Default is `true`.
 * @param baseLoggerCreator The underling global {@link winston.Logger} instance.
 */
export function configureWinstonLogger<T extends LaunchOptions>(
    context: ModuleContext,
    options: T,
    rebind = true,
    baseLoggerCreator: (launchOptions: T) => winston.Logger = createWinstonInstance
): void {
    const baseLogger = baseLoggerCreator(options);
    if (rebind) {
        if (context.isBound(Logger)) {
            context.unbind(Logger);
        }
        if (context.isBound(LoggerFactory)) {
            context.unbind(LoggerFactory);
        }
    }

    context.bind(Logger).toDynamicValue(dynamicContext => new WinstonLogger(baseLogger, getRequestParentName(dynamicContext)));
    context.bind(LoggerFactory).toFactory(dynamicContext => (caller: string) => {
        const logger = dynamicContext.container.get(Logger);
        logger.caller = caller;
        return logger;
    });
}

function getRequestParentName(context: interfaces.Context): string | undefined {
    if (context.currentRequest.parentRequest) {
        const bindings = context.currentRequest.parentRequest.bindings;
        if (bindings.length > 0) {
            return bindings[0].implementationType?.name;
        }
    }
    return undefined;
}
