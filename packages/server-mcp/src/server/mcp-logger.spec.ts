/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

import { Logger, NullLogger } from '@eclipse-glsp/server';
import { ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { expect } from 'chai';
import { Container, ContainerModule } from 'inversify';
import { DefaultMcpLogLevelRegistry, McpLogLevelRegistry } from './mcp-log-level-registry';
import { McpLogger } from './mcp-logger';
import { McpRequestExtra, mcpRequestContext } from './mcp-request-context';

interface RecordedLog {
    level: string;
    message: string;
}

class RecordingLogger extends NullLogger {
    readonly entries: RecordedLog[] = [];
    override info(message: string): void {
        this.entries.push({ level: 'info', message });
    }
    override warn(message: string): void {
        this.entries.push({ level: 'warn', message });
    }
    override error(message: string): void {
        this.entries.push({ level: 'error', message });
    }
    override debug(message: string): void {
        this.entries.push({ level: 'debug', message });
    }
}

function buildLogger(): { logger: McpLogger; glspLogger: RecordingLogger; levelRegistry: DefaultMcpLogLevelRegistry } {
    const container = new Container();
    const glspLogger = new RecordingLogger();
    const levelRegistry = new DefaultMcpLogLevelRegistry();
    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(glspLogger);
            bind(McpLogLevelRegistry).toConstantValue(levelRegistry);
            bind(McpLogger).toSelf().inSingletonScope();
        })
    );
    return { logger: container.get(McpLogger), glspLogger, levelRegistry };
}

/**
 * Build a stub `RequestHandlerExtra` with a recording `sendNotification`. Only `sendNotification`
 * is exercised by `McpLogger`; the remaining fields are never read here, so we cast rather
 * than fabricate the full SDK shape.
 */
function buildExtra(sessionId?: string): { extra: McpRequestExtra; sent: ServerNotification[] } {
    const sent: ServerNotification[] = [];
    const extra = {
        sessionId,
        sendNotification: async (n: ServerNotification) => {
            sent.push(n);
        }
    } as unknown as McpRequestExtra;
    return { extra, sent };
}

describe('McpLogger', () => {
    describe('outside a request context (no MCP client to deliver to)', () => {
        it('routes info/warn/error/debug to the GLSP Logger only', () => {
            const { logger, glspLogger } = buildLogger();

            logger.info('hello');
            logger.warn('careful');
            logger.error('boom');
            logger.debug('trace');

            expect(glspLogger.entries).to.deep.equal([
                { level: 'info', message: 'hello' },
                { level: 'warn', message: 'careful' },
                { level: 'error', message: 'boom' },
                { level: 'debug', message: 'trace' }
            ]);
        });
    });

    describe('inside an mcpRequestContext.run frame', () => {
        it('emits notifications/message to the bound MCP client AND the GLSP Logger', async () => {
            const { logger, glspLogger } = buildLogger();
            const { extra, sent } = buildExtra();

            await mcpRequestContext.run(extra, async () => {
                logger.info('one');
                logger.warn('two');
                logger.error('three');
                logger.debug('four');
                // Allow the fire-and-forget `.catch` chain in McpLogger.notify to settle.
                await new Promise(resolve => setImmediate(resolve));
            });

            expect(glspLogger.entries.map(e => e.message)).to.deep.equal(['one', 'two', 'three', 'four']);
            expect(
                sent.map(n => ({
                    method: n.method,
                    level: (n.params as { level: string }).level,
                    data: (n.params as { data: string }).data
                }))
            ).to.deep.equal([
                { method: 'notifications/message', level: 'info', data: 'one' },
                { method: 'notifications/message', level: 'warning', data: 'two' }, // GLSP warn → MCP warning
                { method: 'notifications/message', level: 'error', data: 'three' },
                { method: 'notifications/message', level: 'debug', data: 'four' }
            ]);
        });

        it('swallows transport failures so a broken MCP send never breaks the producing tool', async () => {
            const { logger, glspLogger } = buildLogger();
            const failingExtra = {
                sendNotification: async () => {
                    throw new Error('transport closed');
                }
            } as unknown as McpRequestExtra;

            await mcpRequestContext.run(failingExtra, async () => {
                expect(() => logger.error('still works')).to.not.throw();
                await new Promise(resolve => setImmediate(resolve));
            });

            // Server-side log still fired.
            expect(glspLogger.entries).to.deep.equal([{ level: 'error', message: 'still works' }]);
        });
    });

    describe('concurrent request contexts', () => {
        it('keeps each request frame isolated via AsyncLocalStorage', async () => {
            const { logger } = buildLogger();
            const { extra: extraA, sent: sentA } = buildExtra();
            const { extra: extraB, sent: sentB } = buildExtra();

            await Promise.all([
                mcpRequestContext.run(extraA, async () => {
                    logger.info('A');
                    await new Promise(resolve => setImmediate(resolve));
                    logger.info('A-after-yield');
                }),
                mcpRequestContext.run(extraB, async () => {
                    logger.info('B');
                    await new Promise(resolve => setImmediate(resolve));
                    logger.info('B-after-yield');
                })
            ]);

            expect(sentA.map(n => (n.params as { data: string }).data)).to.deep.equal(['A', 'A-after-yield']);
            expect(sentB.map(n => (n.params as { data: string }).data)).to.deep.equal(['B', 'B-after-yield']);
        });
    });

    describe('logging/setLevel threshold gate (G4)', () => {
        it('drops messages below the per-session threshold; the GLSP-side log still fires', async () => {
            const { logger, glspLogger, levelRegistry } = buildLogger();
            const { extra, sent } = buildExtra('session-X');
            // Client opted down to "warning" — info and debug must be dropped on the MCP side.
            levelRegistry.setLevel('session-X', 'warning');

            await mcpRequestContext.run(extra, async () => {
                logger.info('chatty');
                logger.debug('verbose');
                logger.warn('important');
                logger.error('critical');
                await new Promise(resolve => setImmediate(resolve));
            });

            // GLSP-side log path is independent of the MCP threshold — keeps adopter logs intact.
            expect(glspLogger.entries.map(entry => entry.message)).to.deep.equal(['chatty', 'verbose', 'important', 'critical']);
            // MCP side: only warn + error survive.
            expect(sent.map(n => (n.params as { level: string }).level)).to.deep.equal(['warning', 'error']);
        });

        it('isolates thresholds across sessions (different setLevel per session id)', async () => {
            const { logger, levelRegistry } = buildLogger();
            const { extra: extraA, sent: sentA } = buildExtra('session-A');
            const { extra: extraB, sent: sentB } = buildExtra('session-B');
            levelRegistry.setLevel('session-A', 'error');
            levelRegistry.setLevel('session-B', 'debug');

            await Promise.all([
                mcpRequestContext.run(extraA, async () => {
                    logger.info('A-info');
                    logger.error('A-error');
                    await new Promise(resolve => setImmediate(resolve));
                }),
                mcpRequestContext.run(extraB, async () => {
                    logger.info('B-info');
                    logger.error('B-error');
                    await new Promise(resolve => setImmediate(resolve));
                })
            ]);

            expect(sentA.map(n => (n.params as { data: string }).data)).to.deep.equal(['A-error']);
            expect(sentB.map(n => (n.params as { data: string }).data).sort()).to.deep.equal(['B-error', 'B-info']);
        });

        it('default threshold (no setLevel sent) lets every level through (preserves prior behavior)', async () => {
            const { logger } = buildLogger();
            const { extra, sent } = buildExtra('session-default');
            // No setLevel call → default threshold = 'debug' → everything emitted.

            await mcpRequestContext.run(extra, async () => {
                logger.debug('d');
                logger.info('i');
                logger.warn('w');
                logger.error('e');
                await new Promise(resolve => setImmediate(resolve));
            });

            expect(sent.map(n => (n.params as { level: string }).level)).to.deep.equal(['debug', 'info', 'warning', 'error']);
        });
    });
});
