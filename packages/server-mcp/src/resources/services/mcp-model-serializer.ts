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

import { GModelElement } from '@eclipse-glsp/graph';
import { Dimension, GModelSerializer, Logger, Point } from '@eclipse-glsp/server';
import { inject, injectable, postConstruct } from 'inversify';
import { McpStructuredContent } from '../../server/mcp-handler-shared';
import { McpIdAliasService } from '../../server/mcp-id-alias-service';
import { objectArrayToMarkdownTable } from '../../util';

export const McpModelSerializer = Symbol('McpModelSerializer');

/** Loose JSON-object shape mirroring `GModelSerializer.createSchema` output — open-keyed because
 * GModel attributes vary per element type. Reads must narrow before use. */
export interface SerializedElement {
    [key: string]: unknown;
}

/**
 * Transforms a graphical model into a representation suitable for LLM consumption. Markdown and
 * JSON are both reasonable formats; the default impl ({@link MarkdownMcpModelSerializer}) emits
 * Markdown for {@link serialize}/{@link serializeArray} and an object payload for
 * {@link serializeStructured} (the dual-emit `structuredContent` counterpart). Aliasing of element
 * ids happens internally via the per-session {@link McpIdAliasService}.
 *
 * @experimental
 */
export interface McpModelSerializer {
    /** Serializes a single element (and its descendants). */
    serialize(element: GModelElement): string;

    /** Serializes an array of elements; duplicates introduced by hierarchy are removed. */
    serializeArray(elements: GModelElement[]): string;

    /**
     * Structured-content counterpart of {@link serialize} for dual-emit
     * (`CallToolResult.structuredContent`). The shape is intentionally open: `{ elements: [...] }`
     * with each entry carrying `id` + `type` + adopter-specific attrs (passthrough).
     */
    serializeStructured(element: GModelElement): McpStructuredContent;

    /** Structured-content counterpart of {@link serializeArray}. */
    serializeStructuredArray(elements: GModelElement[]): McpStructuredContent;
}

/**
 * Default {@link McpModelSerializer} — emits Markdown with one H1 section per element type
 * followed by a table of all elements of that type. Flattens the GModel tree, drops keys with
 * no LLM value (`cssClasses`, `revision`, `layout`, etc., see {@link keysToRemove}), truncates
 * position+size to integers and derives a `bounds` rectangle so the LLM doesn't redo arithmetic.
 *
 * Generic: no control over element order or per-type attribute order, since no specific GLSP
 * adopter is known. Adopters override (see workflow's `WorkflowMcpModelSerializer`) when
 * semantic ordering matters.
 */
@injectable()
export class MarkdownMcpModelSerializer implements McpModelSerializer {
    @inject(GModelSerializer) protected gModelSerializer: GModelSerializer;
    @inject(McpIdAliasService) protected aliasService: McpIdAliasService;
    @inject(Logger) protected logger: Logger;

    protected keysToRemove: string[] = [
        'cssClasses',
        'revision',
        'layout',
        'args',
        'layoutOptions',
        'alignment',
        'children',
        'routingPoints',
        'resizeLocations',
        'parent'
    ];

    /** Warn once per binding when the bare default is used — subclasses suppress via the constructor check. */
    @postConstruct()
    protected warnIfGenericDefault(): void {
        if (this.constructor === MarkdownMcpModelSerializer) {
            this.logger.warn(
                'Using generic MarkdownMcpModelSerializer; bind a diagram-specific subclass via ' +
                    'DefaultMcpDiagramModule.bindModelSerializer() for richer LLM output.'
            );
        }
    }

    serialize(element: GModelElement): string {
        return this.serializeArray([element]);
    }

    serializeArray(elements: GModelElement[]): string {
        return Object.entries(this.buildAliasedTypeBuckets(elements))
            .filter(([, bucket]) => bucket.length > 0)
            .flatMap(([type, bucket]) => [`# ${type}`, objectArrayToMarkdownTable(bucket)])
            .join('\n');
    }

    serializeStructured(element: GModelElement): McpStructuredContent {
        return this.serializeStructuredArray([element]);
    }

    serializeStructuredArray(elements: GModelElement[]): McpStructuredContent {
        return {
            elements: Object.values(this.buildAliasedTypeBuckets(elements))
                .filter(bucket => bucket.length > 0)
                .flat()
        };
    }

    /** Common pipeline: prepare, dedupe by id, group by type, alias ids — used by both renders. */
    protected buildAliasedTypeBuckets(elements: GModelElement[]): Record<string, SerializedElement[]> {
        const elementsByTypeArray = elements.map(element => this.prepareElement(element));
        const result: Record<string, SerializedElement[]> = {};
        const allKeys = new Set(elementsByTypeArray.flatMap(obj => Object.keys(obj)));
        allKeys.forEach(key => {
            const combined = elementsByTypeArray.flatMap(obj => obj[key] ?? []);
            result[key] = Array.from(new Map(combined.map(item => [item.id, item])).values()).map(item => this.applyAlias(item));
        });
        return result;
    }

    protected applyAlias(element: SerializedElement): SerializedElement {
        for (const field of ['id', 'sourceId', 'targetId', 'parentId'] as const) {
            const value = element[field];
            if (typeof value === 'string') {
                element[field] = this.aliasService.alias(value);
            }
        }
        return element;
    }

    protected prepareElement(element: GModelElement): Record<string, SerializedElement[]> {
        const schema = this.gModelSerializer.createSchema(element) as unknown as SerializedElement;
        const elements = this.flattenStructure(schema, element.parent?.id);

        const result: Record<string, SerializedElement[]> = {};
        elements.forEach(elem => {
            this.removeKeys(elem);
            this.combinePositionAndSize(elem);
            const type = typeof elem.type === 'string' ? elem.type : 'unknown';
            (result[type] ??= []).push(elem);
        });

        return result;
    }

    protected flattenStructure(element: SerializedElement, parentId?: string): SerializedElement[] {
        const newElement: SerializedElement = { ...element };
        const result: SerializedElement[] = [newElement];
        const children = newElement.children;
        if (Array.isArray(children)) {
            const ownId = typeof newElement.id === 'string' ? newElement.id : undefined;
            children.forEach(child =>
                this.flattenStructure(child as SerializedElement, ownId).forEach(descendant => result.push(descendant))
            );
        }
        newElement.parentId = parentId;
        return result;
    }

    protected removeKeys(element: SerializedElement): void {
        for (const key of Object.keys(element)) {
            if (this.keysToRemove.includes(key)) {
                delete element[key];
            }
        }
    }

    protected combinePositionAndSize(element: SerializedElement): void {
        const position = element.position;
        if (!Point.is(position)) {
            return;
        }
        const x = Math.trunc(position.x);
        const y = Math.trunc(position.y);
        element.position = { x, y };

        // Omit `size` and `bounds` when an element has no explicit geometry yet (e.g., a freshly
        // created node whose `.size()` has not been applied). Emitting `{width: 0, height: 0}`
        // would mislead an LLM consumer into "fixing" placeholder bounds. Visual rendering on
        // the GLSP/sprotty client is unaffected — those nodes are laid out via CSS regardless.
        const size = element.size;
        if (!Dimension.is(size) || (Math.trunc(size.width) === 0 && Math.trunc(size.height) === 0)) {
            delete element.size;
            delete element.bounds;
            return;
        }

        const width = Math.trunc(size.width);
        const height = Math.trunc(size.height);
        element.size = { width, height };
        element.bounds = {
            left: x,
            right: x + width,
            top: y,
            bottom: y + height
        };
    }
}
