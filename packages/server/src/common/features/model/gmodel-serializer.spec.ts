/********************************************************************************
 * Copyright (c) 2022-2026 STMicroelectronics and others.
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
import { GEdge, getDefaultMapping, GGraph, GNode } from '@eclipse-glsp/graph';
import { beforeEach, describe, expect, it } from 'vitest';
import { Container, ContainerModule } from 'inversify';
import { DiagramConfiguration } from '../../diagram/diagram-configuration';
import * as mock from '../../test/mock-util';
import { GLSPServerError } from '../../utils/glsp-server-error';
import { Logger } from '../../utils/logger';
import { DefaultGModelSerializer } from './gmodel-serializer';

class TestNode extends GNode {
    foo(): void {
        // should not be serialized to schema
    }
}

let testRootSchema: any;

let testNodeSchema: any;

let testNodeSchemaWithParent: any;

describe('test DefaultGModelSerializer', () => {
    const container = new Container();
    const diagramConfiguration = new mock.StubDiagramConfiguration();
    diagramConfiguration['typeMapping'] = getDefaultMapping();
    diagramConfiguration.typeMapping.set('node', TestNode);

    container.load(
        new ContainerModule(bind => {
            bind(Logger).toConstantValue(new mock.StubLogger());
            bind(DiagramConfiguration).toConstantValue(diagramConfiguration);
        })
    );

    const serializer = container.resolve(DefaultGModelSerializer);

    beforeEach(() => {
        testRootSchema = {
            id: 'graph',
            type: 'graph',
            children: [
                { id: 'node1', type: 'node', position: { x: 5, y: 10 } },
                { id: 'node2', type: 'node', position: { x: 15, y: 5 } },
                { id: 'edge1', type: 'edge', sourceId: 'node1', targetId: 'node2' }
            ]
        };
        testNodeSchema = { id: 'node1', type: 'node', position: { x: 5, y: 10 }, children: [], cssClasses: [] };
        testNodeSchemaWithParent = {
            id: 'node1',
            type: 'node',
            position: { x: 5, y: 10 },
            children: [],
            cssClasses: [],
            parent: new GNode()
        };
    });

    it('createElement - unregistered type', () => {
        testNodeSchema['type'] = 'notRegistered';
        expect(() => serializer.createElement(testNodeSchema)).toThrow(GLSPServerError);
    });

    it('createElement - with root schema', () => {
        expect(() => serializer.createElement(testRootSchema)).toThrow(GLSPServerError);
    });

    it('createElement - with node schema', () => {
        const node = serializer.createElement(testNodeSchema);
        expect(node).toBeInstanceOf(TestNode);
        expect(node).toMatchObject(testNodeSchema);
        expect((node as TestNode).foo).toBeDefined();
    });

    it('createElement- with sub type of registered schema', () => {
        testNodeSchema.type = 'node:rectangular';
        const node = serializer.createElement(testNodeSchema);
        expect(node).toBeInstanceOf(TestNode);
        expect(node).toMatchObject(testNodeSchema);
        expect((node as TestNode).foo).toBeDefined();
    });

    it('createElement - with parent', () => {
        const parent = new GNode();
        const child = serializer.createElement(testNodeSchema, parent);
        expect(child).toBeInstanceOf(TestNode);
        expect(child).toMatchObject(testNodeSchemaWithParent);
        expect(child.parent).toBe(parent);
    });

    it('createRoot - unregistered type', () => {
        testRootSchema['type'] = 'notRegistered';
        expect(() => serializer.createRoot(testNodeSchema)).toThrow(GLSPServerError);
    });

    it('createRoot - with child schema ', () => {
        expect(() => serializer.createRoot(testNodeSchema)).toThrow(GLSPServerError);
    });

    it('createRoot - with registered root schema', () => {
        const root = serializer.createRoot(testRootSchema);
        expect(root).toBeInstanceOf(GGraph);
        expect(root.children.length).toBe(3);
        const node1 = root.children[0];
        expect(node1).toBeInstanceOf(TestNode);
        const node2 = root.children[1];
        expect(node2).toBeInstanceOf(TestNode);
        expect(root.children[2]).toBeInstanceOf(GEdge);
        const edge = root.children[2] as GEdge;
        expect(edge.sourceId).toBe(node1.id);
        expect(edge.targetId).toBe(node2.id);
    });

    it('createSchema- unregistered type', () => {
        expect(() => serializer.createRoot({ id: 'id', type: 'unregistered' })).toThrow(GLSPServerError);
    });

    it('createSchema- with node', () => {
        const testNode = new TestNode();
        testNode.position = { x: 5, y: 10 };
        testNode.size = { width: 10, height: 100 };
        testNode.layoutOptions = { ['my']: 'Options' };
        const schema = serializer.createSchema(testNode);
        delete (testNode as Partial<TestNode>).foo;
        expect(schema).toMatchObject(testNode);
    });
});
