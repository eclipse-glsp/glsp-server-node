/********************************************************************************
 * Copyright (c) 2018-2024 TypeFox and others.
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
    findParent,
    GCompartment,
    GEdge,
    GGraph,
    GLabel,
    GModelElement,
    GModelElementConstructor,
    GModelRoot,
    GNode,
    GPort,
    GShapeElement,
    LayoutEngine,
    LayoutOperation,
    Logger,
    MaybePromise,
    ModelState,
    Point
} from '@eclipse-glsp/server';
import { ELK, ElkExtendedEdge, ElkGraphElement, ElkLabel, ElkNode, ElkPort, ElkShape } from 'elkjs/lib/elk-api';
import { inject, injectable } from 'inversify';
import { ElementFilter } from './element-filter';
import { LayoutConfigurator } from './layout-configurator';

/**
 * Factory for ELK instances. Follow the elkjs package documentation on how to configure ELK
 * instances. For example, the bundled version can be used by importing the ELK constructor
 * from `"elkjs/lib/elk.bundled"`. For the webworker version, import the constructor from
 * `"elkjs/lib/elk-api"` and add the option `workerUrl: "elk/elk-worker.min.js"`.
 */
export type ElkFactory = () => ELK;
export const ElkFactory = Symbol('ElkFactory');

/**
 * An implementation of GLSP's {@link LayoutEngine} interface that retrieves the graphical model from the {@link ModelState},
 * transforms this model into an ELK graph and then invokes the underlying ELK instance for layout computation.
 */
@injectable()
export class GlspElkLayoutEngine implements LayoutEngine {
    @inject(Logger)
    protected readonly logger: Logger;

    protected readonly elk: ELK;

    protected elkEdges: ElkExtendedEdge[];
    protected idToElkElement: Map<string, ElkGraphElement>;

    constructor(
        elkFactory: ElkFactory,
        protected readonly filter: ElementFilter,
        protected readonly configurator: LayoutConfigurator,
        protected modelState: ModelState
    ) {
        this.elk = elkFactory();
    }
    layout(layoutOperation: LayoutOperation): MaybePromise<GModelRoot> {
        const root = this.modelState.root;
        if (!(root instanceof GGraph)) {
            return root;
        }

        this.elkEdges = [];
        this.idToElkElement = new Map();
        const elkGraph = this.transformToElk(root);
        return this.elk.layout(elkGraph).then(result => {
            this.applyLayout(result);
            return root;
        });
    }

    protected transformToElk(model: GGraph): ElkNode;
    protected transformToElk(model: GNode): ElkNode;
    protected transformToElk(model: GEdge): ElkExtendedEdge;
    protected transformToElk(model: GLabel): ElkLabel;
    protected transformToElk(model: GPort): ElkPort;
    protected transformToElk(model: GModelElement): ElkGraphElement {
        if (model instanceof GGraph) {
            const graph = this.transformGraph(model);
            this.elkEdges.forEach(elkEdge => {
                const parent = this.findCommonAncestor(elkEdge);
                if (parent) {
                    parent.edges!.push(elkEdge);
                }
            });
            return graph;
        } else if (model instanceof GNode) {
            return this.transformNode(model);
        } else if (model instanceof GEdge) {
            return this.transformEdge(model);
        } else if (model instanceof GLabel) {
            return this.transformLabel(model);
        } else if (model instanceof GPort) {
            return this.transformPort(model);
        }

        throw new Error('Type not supported: ' + model.type);
    }

    /**
     * Searches for all children of the given element that are an instance of the given {@link GModelElementConstructor}
     * and are included by the {@link ElementFilter}. Also considers children that are nested inside of {@link GCompartment}s.
     * @param element The element whose children should be queried.
     * @param constructor The class instance that should be matched
     * @returns A list of all matching children.
     */
    protected findChildren<G extends GModelElement>(element: GModelElement, constructor: GModelElementConstructor<G>): G[] {
        const result: G[] = [];
        element.children.forEach(child => {
            if (child instanceof constructor && this.filter.apply(element)) {
                result.push(child);
            } else if (child instanceof GCompartment) {
                result.push(...this.findChildren(child, constructor));
            }
        });

        return result;
    }

    protected findCommonAncestor(elkEdge: ElkExtendedEdge): ElkNode | undefined {
        if (elkEdge.sources.length === 0 || elkEdge.targets.length === 0) {
            this.logger.warn('Edges with multiple sources or targets are not supported by the GLSPElkLayoutEngine', elkEdge);
            return undefined;
        }
        const source = this.modelState.index.get(elkEdge.sources[0]);
        const target = this.modelState.index.get(elkEdge.targets[0]);
        if (!source || !target) {
            return undefined;
        }

        const sourceParent = findParent(source.parent, parent => parent instanceof GNode || parent instanceof GGraph);
        const targetParent = findParent(target.parent, parent => parent instanceof GNode || parent instanceof GGraph);

        if (!sourceParent || !targetParent) {
            return undefined;
        }

        let ancestor: ElkGraphElement | undefined;
        if (sourceParent === targetParent) {
            ancestor = this.idToElkElement.get(sourceParent.id);
        } else if (source === targetParent) {
            ancestor = this.idToElkElement.get(source.id);
        } else if (target === sourceParent) {
            ancestor = this.idToElkElement.get(target.id);
        }
        return ancestor as ElkNode | undefined;
    }

    protected transformGraph(graph: GGraph): ElkGraphElement {
        const elkGraph: ElkNode = {
            id: graph.id,
            layoutOptions: this.configurator.apply(graph)
        };
        if (graph.children) {
            elkGraph.children = this.findChildren(graph, GNode).map(child => this.transformToElk(child));
            elkGraph.edges = [];
            this.elkEdges.push(...this.findChildren(graph, GEdge).map(child => this.transformToElk(child)));
        }

        this.idToElkElement.set(graph.id, elkGraph);
        return elkGraph;
    }

    protected transformNode(node: GNode): ElkNode {
        const elkNode: ElkNode = {
            id: node.id,
            layoutOptions: this.configurator.apply(node)
        };

        if (node.children) {
            elkNode.children = this.findChildren(node, GNode).map(child => this.transformToElk(child));
            elkNode.edges = [];
            this.elkEdges.push(...this.findChildren(node, GEdge).map(child => this.transformToElk(child)));

            elkNode.labels = this.findChildren(node, GLabel).map(child => this.transformToElk(child));
            elkNode.ports = this.findChildren(node, GPort).map(child => this.transformToElk(child));
        }

        this.transformShape(elkNode, node);
        this.idToElkElement.set(node.id, elkNode);

        return elkNode;
    }

    protected transformShape(elkShape: ElkShape, shape: GShapeElement): void {
        if (shape.position) {
            elkShape.x = shape.position.x;
            elkShape.y = shape.position.y;
        }
        if (shape.size) {
            elkShape.width = shape.size.width;
            elkShape.height = shape.size.height;
        }
    }

    protected transformEdge(edge: GEdge): ElkExtendedEdge {
        const elkEdge: ElkExtendedEdge = {
            id: edge.id,
            sources: [edge.sourceId],
            targets: [edge.targetId],
            layoutOptions: this.configurator.apply(edge)
        };

        if (edge.children) {
            elkEdge.labels = this.findChildren(edge, GLabel).map(child => this.transformToElk(child));
        }
        const points = edge.routingPoints;
        if (points && points.length >= 2) {
            elkEdge.sections = [
                {
                    id: edge.id + ':section',
                    startPoint: points[0],
                    bendPoints: points.slice(1, points.length - 1),
                    endPoint: points[points.length - 1]
                }
            ];
        }
        this.idToElkElement.set(edge.id, elkEdge);
        return elkEdge;
    }

    protected transformLabel(label: GLabel): ElkLabel {
        const elkLabel: ElkLabel = {
            id: label.id,
            text: label.text,
            layoutOptions: this.configurator.apply(label)
        };
        this.transformShape(elkLabel, label);
        this.idToElkElement.set(label.id, elkLabel);
        return elkLabel;
    }

    protected transformPort(port: GPort): ElkPort {
        const elkPort: ElkPort = {
            id: port.id,
            layoutOptions: this.configurator.apply(port)
        };
        if (port.children) {
            elkPort.labels = this.findChildren(port, GLabel).map(child => this.transformToElk(child));
            this.elkEdges.push(...this.findChildren(port, GEdge).map(child => this.transformToElk(child)));
        }
        this.transformShape(elkPort, port);
        this.idToElkElement.set(port.id, elkPort);
        return elkPort;
    }

    protected applyLayout(elkNode: ElkNode): void {
        const element = this.modelState.index.get(elkNode.id);
        if (element instanceof GNode) {
            this.applyShape(element, elkNode);
        }
        if (elkNode.children) {
            for (const child of elkNode.children) {
                this.applyLayout(child);
            }
        }
        if (elkNode.edges) {
            for (const elkEdge of elkNode.edges) {
                const edge = this.modelState.index.get(elkEdge.id);
                if (edge instanceof GEdge) {
                    this.applyEdge(edge, elkEdge);
                }
            }
        }

        if (elkNode.ports) {
            for (const elkPort of elkNode.ports) {
                const port = this.modelState.index.findByClass(elkPort.id, GPort);
                if (port) {
                    this.applyShape(port, elkPort);
                }
            }
        }
    }

    protected applyShape(shape: GShapeElement, elkShape: ElkShape): void {
        if (elkShape.x !== undefined && elkShape.y !== undefined) {
            shape.position = { x: elkShape.x, y: elkShape.y };
        }
        if (elkShape.width !== undefined && elkShape.height !== undefined) {
            shape.size = { width: elkShape.width, height: elkShape.height };
        }

        if (elkShape.labels) {
            for (const elkLabel of elkShape.labels) {
                const label = elkLabel.id ? this.modelState.index.findByClass(elkLabel.id, GLabel) : undefined;
                if (label) {
                    this.applyShape(label, elkLabel);
                }
            }
        }
    }

    protected applyEdge(edge: GEdge, elkEdge: ElkExtendedEdge): void {
        const points: Point[] = [];
        if (elkEdge.sections && elkEdge.sections.length > 0) {
            const section = elkEdge.sections[0];
            if (section.startPoint) {
                points.push(section.startPoint);
            }
            if (section.bendPoints) {
                points.push(...section.bendPoints);
            }
            if (section.endPoint) {
                points.push(section.endPoint);
            }
        }
        edge.routingPoints = points;

        if (elkEdge.labels) {
            elkEdge.labels.forEach(elkLabel => {
                const label = elkLabel.id ? this.modelState.index.findByClass(elkLabel.id, GLabel) : undefined;
                if (label) {
                    this.applyShape(label, elkLabel);
                }
            });
        }
    }
}
