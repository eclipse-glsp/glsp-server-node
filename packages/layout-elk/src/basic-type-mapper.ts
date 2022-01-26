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
import { DiagramConfiguration, GEdge, GGraph, GLabel, GModelElementConstructor, GNode, GPort } from '@eclipse-glsp/server-node';
import { inject, injectable, postConstruct } from 'inversify';
import { SModelElement } from 'sprotty-protocol';

export type BasicGModelType = 'graph' | 'node' | 'edge' | 'label' | 'port' | 'unknown';

@injectable()
/**
 * The `BasicTypeMapper` provides the means to derive the basic type from a given graph model element.
 * The basic type information is used by the `ElkLayoutEngine` to transform graphic model elements into their corresponding ELK object
 * representation.
 */
export class BasicTypeMapper {
    @inject(DiagramConfiguration)
    protected diagramConfiguration: DiagramConfiguration;

    protected basicTypeMap: Map<string, BasicGModelType>;

    @postConstruct()
    protected postConstruct(): void {
        this.basicTypeMap = new Map();
        this.diagramConfiguration.typeMapping.forEach((constructor, type) => {
            const basicType = this.toBasicType(constructor);
            if (basicType) {
                this.basicTypeMap.set(type, basicType);
            }
        });
    }

    protected toBasicType(constructor: GModelElementConstructor): BasicGModelType {
        const element = new constructor();
        if (element instanceof GNode) {
            return 'node';
        } else if (element instanceof GEdge) {
            return 'edge';
        } else if (element instanceof GGraph) {
            return 'graph';
        } else if (element instanceof GLabel) {
            return 'label';
        } else if (element instanceof GPort) {
            return 'port';
        }
        return 'unknown';
    }

    getBasicType(input: SModelElement | string): BasicGModelType {
        const type = typeof input === 'string' ? input : input.type;
        const basicType = this.basicTypeMap.get(type);
        if (basicType) {
            return basicType;
        }
        const subtypeSeparator = type.lastIndexOf(':');
        if (subtypeSeparator > 0) {
            return this.getBasicType(type.substring(0, subtypeSeparator));
        }
        return 'unknown';
    }
}
