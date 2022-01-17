/********************************************************************************
 * Copyright (c) 2017-2022 TypeFox and other
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
/* Derived from sprotty (https://github.com/eclipse/sprotty/blob/master/packages/sprotty/src/base/model/smodel-factory.ts) */
import { GModelElement, GModelElementConstructor, GModelRoot } from '@eclipse-glsp/graph';
import { SModelElementSchema, SModelRootSchema } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { DiagramConfiguration } from '../../diagram/diagram-configuration';
import { GLSPServerError } from '../../utils/glsp-server-error';

export const GModelSerializer = Symbol('GModelSerializer');

export interface GModelSerializer {
    createRoot(schema: SModelRootSchema): GModelRoot;

    createElement(schema: SModelElementSchema, parent?: GModelElement): GModelElement;

    createSchema(element: GModelElement): SModelElementSchema;

    reservedKeys: string[];
}

@injectable()
export class DefaultGModelSerializer implements GModelSerializer {
    @inject(DiagramConfiguration) protected diagramConfiguration: DiagramConfiguration;

    reservedKeys = ['children', 'parent', 'index'];
    createRoot(schema: SModelElementSchema): GModelRoot {
        const constructor = this.getConfiguredConstructor(schema);
        if (constructor) {
            const element = new constructor();
            if (!(element instanceof GModelRoot)) {
                throw new GLSPServerError(`Element with type '${schema.type}' is expected to be a GModelRoot!`);
            }
            return this.initializeRoot(element, schema);
        }
        throw new GLSPServerError(`No constructor is configured in DiagramConfiguration for type ${schema.type}`);
    }

    getConfiguredConstructor(schema: SModelElementSchema): GModelElementConstructor | undefined {
        let key = schema.type;
        while (!this.diagramConfiguration.typeMapping.has(key)) {
            const i = key.lastIndexOf(':');
            if (i > 0) {
                key = key.substring(0, i);
            } else {
                return undefined;
            }
        }

        const constructor = this.diagramConfiguration.typeMapping.get(key)!;
        if (key !== schema.type) {
            this.diagramConfiguration.typeMapping.set(key, constructor);
        }
        return constructor;
    }

    createElement(schema: SModelElementSchema, parent?: GModelElement): GModelElement {
        const constructor = this.getConfiguredConstructor(schema);
        if (constructor) {
            const element = new constructor();
            if (element instanceof GModelRoot) {
                throw new GLSPServerError(
                    `Element with type '${schema.type}' is a GModelRoot! 'createElement()' is expected to only create child elements!`
                );
            }
            return this.initializeChild(element, schema, parent);
        }
        throw new GLSPServerError(`No constructor is configured in DiagramConfiguration for type ${schema.type}`);
    }

    createSchema(element: GModelElement): SModelElementSchema {
        const schema = {};
        for (const key in element) {
            if (!this.isReserved(element, key)) {
                const value: any = (element as any)[key];
                if (typeof value !== 'function') {
                    (schema as any)[key] = value;
                }
            }
        }
        (schema as any)['children'] = (element.children ?? []).map(child => this.createSchema(child));

        return schema as SModelElementSchema;
    }

    protected initializeRoot(root: GModelRoot, schema: SModelRootSchema): GModelRoot {
        this.initializeParent(root, schema);
        return root;
    }

    protected initializeElement(element: GModelElement, schema: SModelElementSchema): GModelElement {
        for (const key in schema) {
            if (!this.isReserved(element, key)) {
                const value = (schema as any)[key];
                if (typeof value !== 'function') {
                    (element as any)[key] = value;
                }
            }
        }
        return element;
    }

    protected initializeChild(child: GModelElement, schema: SModelElementSchema, parent?: GModelElement): GModelElement {
        this.initializeParent(child, schema);
        if (parent) {
            child.parent = parent;
        }
        return child;
    }

    protected initializeParent(parent: GModelElement, schema: SModelElementSchema): GModelElement {
        this.initializeElement(parent, schema);
        if (schema.children) {
            parent.children = schema.children.map(childSchema => this.createElement(childSchema, parent));
        }

        return parent;
    }

    protected isReserved(element: GModelElement, propertyName: string): boolean {
        if (this.reservedKeys.indexOf(propertyName) >= 0) {
            return true;
        }
        let obj = element;
        do {
            const descriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
            if (descriptor !== undefined) {
                return descriptor.get !== undefined;
            }
            obj = Object.getPrototypeOf(obj);
        } while (obj);
        return false;
    }
}
