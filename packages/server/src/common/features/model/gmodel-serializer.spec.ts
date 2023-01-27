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
import { GEdge, getDefaultMapping, GGraph, GNode } from '@eclipse-glsp/graph';
import { expect } from 'chai';
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
        expect(() => serializer.createElement(testNodeSchema)).to.throw(GLSPServerError);
    });

    it('createElement - with root schema', () => {
        expect(() => serializer.createElement(testRootSchema)).to.throw(GLSPServerError);
    });

    it('createElement - with node schema', () => {
        const node = serializer.createElement(testNodeSchema);
        expect(node).to.be.an.instanceOf(TestNode);
        expect(node).to.be.deep.include(testNodeSchema);
        expect((node as TestNode).foo).to.not.be.undefined;
    });

    it('createElement- with sub type of registered schema', () => {
        testNodeSchema.type = 'node:rectangular';
        const node = serializer.createElement(testNodeSchema);
        expect(node).to.be.an.instanceOf(TestNode);
        expect(node).to.be.deep.include(testNodeSchema);
        expect((node as TestNode).foo).to.not.be.undefined;
    });

    it('createElement - with parent', () => {
        const parent = new GNode();
        const child = serializer.createElement(testNodeSchema, parent);
        expect(child).to.be.an.instanceOf(TestNode);
        expect(child).to.be.deep.include(testNodeSchemaWithParent);
        expect(child.parent).to.be.equal(parent);
    });

    it('createRoot - unregistered type', () => {
        testRootSchema['type'] = 'notRegistered';
        expect(() => serializer.createRoot(testNodeSchema)).to.throw(GLSPServerError);
    });

    it('createRoot - with child schema ', () => {
        expect(() => serializer.createRoot(testNodeSchema)).to.throw(GLSPServerError);
    });

    it('createRoot - with registered root schema', () => {
        const root = serializer.createRoot(testRootSchema);
        expect(root).to.be.an.instanceOf(GGraph);
        expect(root.children.length).to.be.equal(3);
        const node1 = root.children[0];
        expect(node1).to.be.an.instanceOf(TestNode);
        const node2 = root.children[1];
        expect(node2).to.be.an.instanceOf(TestNode);
        expect(root.children[2]).to.be.an.instanceOf(GEdge);
        const edge = root.children[2] as GEdge;
        expect(edge.sourceId).to.be.equal(node1.id);
        expect(edge.targetId).to.be.equal(node2.id);
    });

    it('createSchema- unregistered type', () => {
        expect(() => serializer.createRoot({ id: 'id', type: 'unregistered' })).to.throw(GLSPServerError);
    });

    it('createSchema- with node', () => {
        const testNode = new TestNode();
        testNode.position = { x: 5, y: 10 };
        testNode.size = { width: 10, height: 100 };
        testNode.layoutOptions = { ['my']: 'Options' };
        const schema = serializer.createSchema(testNode);
        delete (testNode as Partial<TestNode>).foo;
        expect(schema).to.be.deep.include(testNode);
    });
});
