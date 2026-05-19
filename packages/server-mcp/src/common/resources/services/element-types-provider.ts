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

import { CreateEdgeOperation, CreateNodeOperation } from '@eclipse-glsp/protocol';
import {
    CreateEdgeOperationHandler,
    CreateNodeOperationHandler,
    CreateOperationHandler,
    Logger,
    OperationHandlerRegistry
} from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';

/**
 * A discoverable creatable element type emitted by the `element-types` tool handler. Adopters
 * may add further passthrough fields beyond these — the tool handler's structured output schema
 * is `loose()`.
 *
 * @experimental
 */
export interface ElementTypeEntry {
    id: string;
    /** Human-readable display name for the element TYPE (e.g. `Manual Task`). */
    label: string;
    /** Adopter-supplied human-readable description; absent on the default scrape impl. */
    description?: string;
    /** Whether create-* / modify-* tools should pass a `text` arg for this type. Absent ⇒ unknown. */
    acceptsText?: boolean;
}

/** Node + edge types creatable in a given diagram type. */
export interface ElementTypes {
    nodeTypes: ElementTypeEntry[];
    edgeTypes: ElementTypeEntry[];
}

/**
 * Per-diagram-type provider of creatable element types. Bound on the diagram (per-GLSP-session)
 * container so each diagram type can supply its own list. Adopters with explicit type info
 * typically rebind to a constant-value provider; the default scrapes
 * {@link OperationHandlerRegistry} for backwards compatibility with adopters that haven't
 * declared their types yet.
 *
 * @experimental
 */
export interface ElementTypesProvider {
    get(): ElementTypes;
}
export const ElementTypesProvider = Symbol('ElementTypesProvider');

/**
 * Default {@link ElementTypesProvider} that scrapes the per-session {@link OperationHandlerRegistry}
 * for {@link CreateNodeOperationHandler} / {@link CreateEdgeOperationHandler} instances and reads
 * their `elementTypeIds`.
 */
@injectable()
export class DefaultElementTypesProvider implements ElementTypesProvider {
    @inject(OperationHandlerRegistry) protected operationHandlerRegistry: OperationHandlerRegistry;

    @inject(Logger) protected logger: Logger;

    /** Already-warned operation types, deduped so the warn fires once per type. */
    protected readonly warnedTypes = new Set<string>();

    get(): ElementTypes {
        const nodeTypes: ElementTypeEntry[] = [];
        const edgeTypes: ElementTypeEntry[] = [];
        for (const handler of this.operationHandlerRegistry.getAll()) {
            if (CreateNodeOperationHandler.is(handler)) {
                handler.elementTypeIds.forEach(id => nodeTypes.push({ id, label: handler.label }));
            } else if (CreateEdgeOperationHandler.is(handler)) {
                handler.elementTypeIds.forEach(id => edgeTypes.push({ id, label: handler.label }));
            } else if (CreateOperationHandler.is(handler)) {
                this.warnUnrecognizedOperationType(handler);
            }
        }
        return { nodeTypes, edgeTypes };
    }

    /** Once-per-type warn when a `CreateOperationHandler` carries an unrecognized `operationType`. */
    protected warnUnrecognizedOperationType(handler: CreateOperationHandler): void {
        const operationType = handler.operationType;
        if (this.warnedTypes.has(operationType)) {
            return;
        }
        this.warnedTypes.add(operationType);
        this.logger.warn(
            `DefaultElementTypesProvider: ignoring CreateOperationHandler with operationType '${operationType}' — ` +
                `expected '${CreateNodeOperation.KIND}' or '${CreateEdgeOperation.KIND}'. Rebind ElementTypesProvider for custom operation types.`
        );
    }
}
