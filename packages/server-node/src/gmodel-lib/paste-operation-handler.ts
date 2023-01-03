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
import { GBoundsAware, GEdge, GModelElement, isGBoundsAware } from '@eclipse-glsp/graph';
import { PasteOperation, Point, SModelElementSchema, TypeGuard } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid';
import { GModelSerializer } from '../features/model/gmodel-serializer';
import { ModelState } from '../features/model/model-state';
import { OperationHandler } from '../operations/operation-handler';

@injectable()
export class PasteOperationHandler implements OperationHandler {
    operationType = PasteOperation.KIND;

    protected readonly DEFAULT_OFFSET = 20;

    @inject(ModelState)
    protected modelState: ModelState;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    execute(operation: PasteOperation): void {
        const schemas: SModelElementSchema[] = JSON.parse(operation.clipboardData['application/json']);
        const elements = schemas.map(schema => this.modelSerializer.createElement(schema, this.modelState.root));
        shift(elements, this.computeOffset(elements, operation.editorContext.lastMousePosition));
        const idMap = this.reassignIds(elements);
        this.filterElements(elements, idMap);
        this.rewireEdges(elements, idMap);

        this.modelState.root.children.push(...elements);
    }

    protected computeOffset(elements: GModelElement[], lastMousePosition?: Point): Point {
        const offset = { x: this.DEFAULT_OFFSET, y: this.DEFAULT_OFFSET };
        if (lastMousePosition) {
            const referenceElement = this.getReferenceElementForPasteOffset(elements);
            if (referenceElement) {
                const position = referenceElement.position ?? Point.ORIGIN;
                offset.x = lastMousePosition.x - position.x;
                offset.y = lastMousePosition.y - position.y;
            }
        }
        return offset;
    }

    protected getReferenceElementForPasteOffset(elements: GModelElement[]): GBoundsAware | undefined {
        let minY = Number.MAX_VALUE;
        for (const element of elements) {
            if (isGBoundsAware(element)) {
                const position = element.position ?? Point.ORIGIN;
                if (minY > position.y) {
                    minY = position.y;
                    return element;
                }
            }
        }
        return undefined;
    }

    protected reassignIds(elements: GModelElement[]): Map<string, string> {
        const idMap = new Map<string, string>();
        elements.forEach(element => {
            const newId = uuid.v4();
            idMap.set(element.id, newId);
            element.id = newId;
            const childMap = this.reassignIds(element.children);
            childMap.forEach((value, key) => {
                idMap.set(key, value);
            });
        });
        return idMap;
    }

    protected filterElements(elements: GModelElement[], idMap: Map<string, string>): void {
        elements.filter(e => !this.shouldExcludeElement(e, idMap));
    }

    protected shouldExcludeElement(element: GModelElement, idMap: Map<string, string>): boolean {
        return false;
    }

    protected rewireEdges(elements: GModelElement[], idMap: Map<string, string>): void {
        const edges = elements.filter(element => element instanceof GEdge) as GEdge[];
        edges.forEach(edge => {
            const sourceId = idMap.get(edge.sourceId);
            if (sourceId) {
                edge.sourceId = sourceId;
            }
            const targetId = idMap.get(edge.targetId);
            if (targetId) {
                edge.targetId = targetId;
            }
        });
    }
}

export function shift(elements: GModelElement[], offset: Point): void {
    elements
        .filter(element => isGBoundsAware(element))
        .map(element => element as unknown as GBoundsAware)
        .forEach(gBoundsAware => {
            const position = gBoundsAware.position ?? Point.ORIGIN;
            gBoundsAware.position = { x: position.x + offset.x, y: position.y + offset.y };
        });
}

export function filterByType<T extends GModelElement>(elements: GModelElement[], guard: TypeGuard<T>): T[] {
    return elements.filter(element => guard(element)) as T[];
}
