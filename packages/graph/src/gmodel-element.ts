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
import {
    Args,
    Bounds,
    Dimension,
    flatPush,
    isSModelElementSchema,
    JsonPrimitive,
    MaybeArray,
    Point,
    SModelElementSchema,
    SModelRootSchema
} from '@eclipse-glsp/protocol';
import * as uuid from 'uuid';
export type GModelElementConstructor<G extends GModelElement = GModelElement> = new () => G;
/**
 * Represents a `GModeElement` serialized as plain JSON object.
 */
export type GModelElementSchema = SModelElementSchema;

export function isGModelElementSchema(schema: any): schema is GModelElementSchema {
    return isSModelElementSchema(schema);
}

/**
 * Base type for all elements of the graphical model.
 * Each model element must have a unique ID and a type that is used to look up its view.
 */
export abstract class GModelElement implements GModelElementSchema {
    /**
     * The `type` of a `GModelElement` has two main purposes. It is used by the GLSP client
     * during the rendering phase to lookup the View that is responsible for rendering this element.
     * In addition, it serves as the discriminator for serialization & deserialization of `GModeElements` and their corresponding
     * `GModelElementSchema`. e.g. If the glsp server receives a `GModelElementSchema` (plain JSON object) the type is used to
     * lookup and construct the corresponding `GModelElement` class.
     */
    type: string;
    /**
     * Each model element must have a unique ID. Duplicate ids in the graphical element will result in an error during the
     * rendering phase.
     */
    id: string;
    /**
     * A set of css classes that should be applied to the DOM element that corresponds to this element.
     */
    cssClasses: string[] = [];
    /** A `GModelElement can have an arbitrary amount of children. This parent-child relation ship is also reflected in
     * the corresponding DOM element i.e. DOM elements that reflect children of this element are also children
     * of the DOM element that reflects this element.
     */
    children: GModelElement[] = [];
    /**
     * Each `GModelElement` (apart from  the root element) must have an assigned parent. Orphan elements are not allowed.
     */
    parent: GModelElement;
    /**
     * Additional custom arguments. Can be used to transmit additional information between client & server without
     * having to extend the model.
     */
    args?: Args;

    /**
     * Retrieve the {@link GModelRoot} element by traversing up the parent hierachy.
     */
    get root(): GModelRoot {
        let current: GModelElement = this;
        while (!(current instanceof GModelRoot)) {
            current = current.parent;
        }
        return current;
    }
}

/**
 * A fluent builder API that simplifies the construction of complex {@link GModelElement}s.
 * The builder API is derived from the Java GLSP server implementation where it is used to hide the complexity
 * of creating EMF objects. However, the API is also useful in a Typescript/Node context to declare the creation of a new
 * {@link GModelElement} in a more concise way.
 */
export abstract class GModelElementBuilder<G extends GModelElement> {
    protected proxy: G;
    protected elementConstructor: GModelElementConstructor<G>;

    constructor(elementConstructor: GModelElementConstructor<G>) {
        this.elementConstructor = elementConstructor;
        this.proxy = new elementConstructor();
        this.proxy.cssClasses = [];
        this.proxy.children = [];
        this.proxy.id = uuid.v4();
    }

    reset(): this {
        this.proxy = new this.elementConstructor();
        return this;
    }

    build(): G {
        const element = new this.elementConstructor();
        Object.assign(element, this.proxy);
        element.children.forEach(child => (child.parent = element));
        if (element.id === undefined) {
            throw new Error('The `id` property of a GModelElement must not be undefined!');
        }
        if (element.type === undefined) {
            throw new Error('The `type` property of a GModelElement must not be undefined!');
        }
        return element;
    }

    id(id: string): this {
        this.proxy.id = id;
        return this;
    }

    type(type: string): this {
        this.proxy.type = type;
        return this;
    }

    addCssClass(cssClass: string): this {
        this.proxy.cssClasses.push(cssClass);
        return this;
    }

    addCssClasses(cssClasses: string[]): this;
    addCssClasses(...cssClasses: string[]): this;
    addCssClasses(...cssClasses: MaybeArray<string>[]): this {
        flatPush(this.proxy.cssClasses, cssClasses);
        return this;
    }

    add(child: GModelElement): this {
        this.proxy.children.push(child);
        return this;
    }

    addChildren(children: GModelElement[]): this;
    addChildren(...children: GModelElement[]): this;
    addChildren(...children: MaybeArray<GModelElement>[]): this {
        flatPush(this.proxy.children, children);
        return this;
    }

    addArg(key: string, value: JsonPrimitive): this {
        if (!this.proxy.args) {
            this.proxy.args = {};
        }
        this.proxy.args[key] = value;
        return this;
    }

    addArgs(args: Args): this;
    addArgs(args: Map<string, JsonPrimitive>): this;
    addArgs(args: Args | Map<string, JsonPrimitive>): this {
        const toAssign: Args = {};
        if (args instanceof Map) {
            [...args.keys()].forEach(key => (toAssign[key] = args.get(key)!));
        } else {
            Object.keys(args).forEach(key => (toAssign[key] = args[key]));
        }
        if (this.proxy.args) {
            Object.assign(this.proxy.args, toAssign);
        } else {
            this.proxy.args = toAssign;
        }
        return this;
    }
}

export type GModelRootSchema = SModelRootSchema;

export function isGModelRootSchema(schema: any): schema is GModelRootSchema {
    return isSModelElementSchema(schema);
}

export class GModelRoot extends GModelElement implements SModelRootSchema {
    static builder(): GModelRootBuilder {
        return new GModelRootBuilder(GModelRoot);
    }

    canvasBounds?: Bounds;
    revision = 0;
}

export class GModelRootBuilder<G extends GModelRoot = GModelRoot> extends GModelElementBuilder<G> {
    revision(revision: number): this {
        this.proxy.revision = revision;
        return this;
    }

    canvasBounds(position: Point, size: Dimension): this;
    canvasBounds(bounds: Bounds): this;
    canvasBounds(positionOrBounds: Point | Bounds, size?: Dimension): this {
        let bounds: Bounds;
        if (size) {
            bounds = { ...positionOrBounds, ...size };
        } else {
            bounds = positionOrBounds as Bounds;
        }
        this.proxy.canvasBounds = bounds;
        return this;
    }
}
