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
import * as cmd from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { LogLevel, LoggerConfigOptions, asLogLevel } from '../../common/utils/logger';

export interface LaunchOptions extends LoggerConfigOptions {
    logLevel: LogLevel;
    logDir?: string;
    fileLog: boolean;
}

export interface CliParser<O extends LaunchOptions = LaunchOptions> {
    command: cmd.Command;
    parse(argv?: string[]): O;
}

export const defaultLaunchOptions: Required<LaunchOptions> = {
    logLevel: LogLevel.info,
    logDir: '.config',
    consoleLog: true,
    fileLog: false
};

export function createCliParser<O extends LaunchOptions = LaunchOptions>(options: LaunchOptions = defaultLaunchOptions): CliParser<O> {
    const command = new cmd.Command()
        .version('1.0.0')
        .description('GLSP server')
        .showHelpAfterError(true)
        .name('Launch a GLSP server')
        .option('-l , --logLevel <logLevel>', `Set the log level. [default='${options.logLevel}']`, processLogLevel, options.logLevel)
        .option(
            '-d , --logDir <logDir>',
            `Set the directory for log files (when file logging is enabled) [default=${options.logDir}]`,
            processLogDir,
            options.logDir
        )
        .addHelpText('afterAll', '\n Copyright (c) 2022-2023 Eclipse GLSP');

    return { command, parse: argv => parse<O>(command, options as Partial<O>, argv) };
}

export function parse<T extends cmd.OptionValues>(command: cmd.Command, defaultOptions: Partial<T>, argv?: string[]): T {
    command.parse(argv);
    return { ...defaultOptions, ...command.opts<T>() };
}

export function processLogLevel(value: string): LogLevel {
    const level = asLogLevel(value);
    if (!level) {
        throw new cmd.InvalidArgumentError("Argument has to be 'none'|'error'|'warn'|'info'|'debug'!");
    }
    return level;
}

export function processLogDir(value: string): string {
    const logDir = path.resolve(value);
    if (path.extname(logDir).length !== 0 || !isDirectory(path.dirname(logDir))) {
        throw new cmd.InvalidArgumentError('Argument is not a valid directory!');
    }

    return logDir;
}

export function isDirectory(value: string): boolean {
    try {
        return fs.statSync(value).isDirectory();
    } catch (error) {
        return false;
    }
}
