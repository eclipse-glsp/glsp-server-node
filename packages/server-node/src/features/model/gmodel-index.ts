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
import { GEdge, GModelElement, GModelElementConstructor, GModelRoot, GNode } from '@eclipse-glsp/graph';
import { DefaultTypes } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { getOrThrow, GLSPServerError } from '../../utils/glsp-server-error';

/**
 * Is used to index all child elements of a {@link GModelRoot} by their id. Offers a set
 * of query methods to retrieve indexed elements.
 */
@injectable()
export class GModelIndex {
    protected idToElement: Map<string, GModelElement>;
    protected typeToElements: Map<string, GModelElement[]>;

    constructor() {
        this.idToElement = new Map();
        this.typeToElements = new Map();
    }

    clear(): void {
        this.idToElement.clear();
        this.typeToElements.clear();
    }

    indexRoot(root: GModelRoot): void {
        this.clear();
        this.doIndex(root);
    }

    protected doIndex(element: GModelElement): void {
        if (this.idToElement.has(element.id)) {
            throw new GLSPServerError('Duplicate ID in model: ' + element.id);
        }
        this.idToElement.set(element.id, element);
        const typeSet = this.typeToElements.get(element.type) ?? [];
        typeSet.push(element);
        this.typeToElements.set(element.type, typeSet);
        (element.children ?? []).forEach(child => this.doIndex(child));
    }

    find(elementId: string, predicate?: (test: GModelElement) => boolean): GModelElement | undefined {
        const element = this.idToElement.get(elementId);
        if (element && predicate ? predicate(element) : true) {
            return element;
        }
        return undefined;
    }

    findByClass<G extends GModelElement>(elementTypeId: string, constructor: GModelElementConstructor<G>): G | undefined {
        const element = this.find(elementTypeId);
        if (element && element instanceof constructor) {
            return element;
        }
        return undefined;
    }

    /**
     * Returns an optional {@link GModelElement} by its elementId.
     *
     * @param elementId The id of the requested {@link GModelElement}.
     * @returns An optional instance of the {@link GModelElement}.
     */
    get(elementId: string): GModelElement {
        return getOrThrow(this.find(elementId), `Could not retrieve element with id: '${elementId}'`);
    }

    /**
     * Returns a set of {@link GModelElement} instances by a Collection of elementIds.
     *
     * @param elementIds The ids to request the {@link GModelElement} from an array of elementIds.
     * @returns A set of {@link GModelElement}s.
     */
    getAll(elementIds: string[]): GModelElement[] {
        return elementIds.map(id => this.idToElement.get(id)).filter(element => element) as GModelElement[];
    }

    /**
     * Returns all elements of the type constructor contained in the {@link GModelRoot}.
     *
     * @type Type of the elements to be returned.
     * @param constructor The class of which the returned elements should be instances.
     * @returns A set containing the elements of type constructor.
     */
    getAllByClass<G extends GNode>(constructor: GModelElementConstructor): G[] {
        return Array.from(this.idToElement.values()).filter(element => element instanceof constructor) as G[];
    }

    /**
     * Returns a list of all {@link GModelElement} ids contained in this instance of the GModelIndex.
     *
     * @returns A list of elementIds.
     */
    allIds(): string[] {
        return Array.from(this.idToElement.keys());
    }

    /**
     * Returns all elements of a type {@link GModelRoot}.
     *
     * @param type   Type of the elements to be returned.
     * @returns A set containing the elements of the given type.
     */
    getElements(type: string): GModelElement[] {
        return this.typeToElements.get(type) ?? [];
    }

    /**
     * Returns the current amount of type occurrences in this instance of the GModelIndex.
     *
     * @param eClass The EClass to be counted in this instance of the GModelIndex.
     *
     * @returns The amount of type occurrences.
     */
    typeCount(type: string): number {
        return this.getElements(type).length;
    }

    /**
     * Returns all incoming edges for a node.
     *
     * @param node The node where the edges are connected.
     *
     * @returns All incoming edges.
     */
    getIncomingEdges(node: GNode): GEdge[] {
        return this.getAllEdges().filter(edge => edge.targetId === node.id);
    }

    /**
     * Returns all outgoing edges for a node.
     *
     * @param node The node where the edges are connected.
     *
     * @returns All outgoing edges.
     */
    getOutgoingEdges(node: GModelElement): GEdge[] {
        return this.getAllEdges().filter(edge => edge.sourceId === node.id);
    }

    /**
     * Returns all edges in the index.
     *
     * @returns All edges in the index.
     */
    getAllEdges(): GEdge[] {
        const edges: GEdge[] = [];
        this.getElements(DefaultTypes.EDGE).forEach(edge => {
            if (edge instanceof GEdge) {
                edges.push(edge);
            }
        });
        return edges;
    }
}
