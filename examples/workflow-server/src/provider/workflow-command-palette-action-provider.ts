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
    CommandPaletteActionProvider,
    CreateEdgeOperation,
    CreateNodeOperation,
    DefaultTypes,
    DeleteElementOperation,
    GModelElement,
    GModelState,
    GNode,
    LabeledAction,
    ORIGIN_POINT,
    Point
} from '@eclipse-glsp/server-node';
import { inject, injectable } from 'inversify';
import { TaskNode } from '../graph-extension';
import { ModelTypes } from '../util/model-types';

@injectable()
export class WorkflowCommandPaletteActionProvider extends CommandPaletteActionProvider {
    @inject(GModelState)
    protected modelState: GModelState;

    getPaletteActions(selectedElementIds: string[], selectedElements: GModelElement[], position: Point, args?: Args): LabeledAction[] {
        const actions: LabeledAction[] = [];
        if (this.modelState.isReadonly) {
            return actions;
        }
        const index = this.modelState.index;
        // Create actions
        actions.push(
            new LabeledAction(
                'Create Automated Task',
                [new CreateNodeOperation(ModelTypes.AUTOMATED_TASK, position ?? ORIGIN_POINT)],
                'fa-plus-square'
            ),
            new LabeledAction(
                'Create Manual Task',
                [new CreateNodeOperation(ModelTypes.MANUAL_TASK, position ?? ORIGIN_POINT)],
                'fa-plus-square'
            ),
            new LabeledAction(
                'Create Merge Node',
                [new CreateNodeOperation(ModelTypes.MERGE_NODE, position ?? ORIGIN_POINT)],
                'fa-plus-square'
            ),
            new LabeledAction(
                'Create Decision Node',
                [new CreateNodeOperation(ModelTypes.DECISION_NODE, position ?? ORIGIN_POINT)],
                'fa-plus-square'
            ),
            new LabeledAction('Create Category', [new CreateNodeOperation(ModelTypes.CATEGORY, position ?? ORIGIN_POINT)], 'fa-plus-square')
        );
        // Create edge action between two nodes
        if (selectedElements.length === 1) {
            const element = selectedElements[0];
            if (element instanceof GNode) {
                actions.push(...this.createEdgeActions(element, index.getAllByClass(TaskNode)));
            }
        } else if (selectedElements.length === 2) {
            const source = selectedElements[0];
            const target = selectedElements[1];
            if (source instanceof TaskNode && target instanceof TaskNode) {
                actions.push(
                    this.createEdgeAction(`Create Edge from ${this.getLabel(source)} to ${this.getLabel(target)}`, source, target)
                );
                actions.push(
                    this.createWeightedEdgeAction(
                        `Create Weighted Edge from ${this.getLabel(source)} to ${this.getLabel(target)}`,
                        source,
                        target
                    )
                );
            }
        }
        // Delete action
        if (selectedElements.length === 1) {
            actions.push(new LabeledAction('Delete', [new DeleteElementOperation(selectedElementIds)], 'fa-minus-square'));
        } else if (selectedElements.length > 1) {
            actions.push(new LabeledAction('Delete All', [new DeleteElementOperation(selectedElementIds)], 'fa-minus-square'));
        }

        return actions;
    }

    private createEdgeActions(source: GNode, targets: GNode[]): LabeledAction[] {
        const actions: LabeledAction[] = [];
        targets.forEach(node => actions.push(this.createEdgeAction(`Create Edge to ${this.getLabel(node)}`, source, node)));
        targets.forEach(node =>
            actions.push(this.createWeightedEdgeAction(`Create Weighted Edge to ${this.getLabel(node)}`, source, node))
        );
        return actions;
    }

    private createWeightedEdgeAction(label: string, source: GNode, node: GNode): LabeledAction {
        return new LabeledAction(label, [new CreateEdgeOperation(ModelTypes.WEIGHTED_EDGE, source.id, node.id)], 'fa-plus-square');
    }

    private createEdgeAction(label: string, source: GNode, node: GNode): LabeledAction {
        return new LabeledAction(label, [new CreateEdgeOperation(DefaultTypes.EDGE, source.id, node.id)], 'fa-plus-square');
    }

    private getLabel(node: GNode): string {
        if (node instanceof TaskNode) {
            return node.name;
        }
        return node.id;
    }
}
