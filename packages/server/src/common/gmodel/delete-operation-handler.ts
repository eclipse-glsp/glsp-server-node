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
import { GModelElement, GNode, GPort } from '@eclipse-glsp/graph';
import { DeleteElementOperation, MaybePromise } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { Command } from '../command/command';
import { GModelIndex } from '../features/model/gmodel-index';
import { Logger } from '../utils/logger';
import { GModelOperationHandler } from './gmodel-operation-handler';

@injectable()
export class GModelDeleteOperationHandler extends GModelOperationHandler {
    @inject(Logger)
    protected logger: Logger;

    protected allDependentsIds: Set<string>;

    get operationType(): string {
        return DeleteElementOperation.KIND;
    }

    createCommand(operation: DeleteElementOperation): MaybePromise<Command | undefined> {
        const elementIds = operation.elementIds;
        if (!elementIds || elementIds.length === 0) {
            this.logger.warn('Elements to delete are not specified');
            return undefined;
        }
        return this.commandOf(() => this.deleteElements(elementIds));
    }

    deleteElements(elementIds: string[]): MaybePromise<void> {
        if (!elementIds || elementIds.length === 0) {
            this.logger.warn('Elements to delete are not specified');
            return;
        }
        const index = this.modelState.index;
        this.allDependentsIds = new Set<string>();
        const success = elementIds.every(eId => this.delete(eId, index));
        if (!success) {
            this.logger.warn('Could not delete all elements as requested (see messages above to find out why)');
        }
    }

    protected delete(elementId: string, index: GModelIndex): boolean {
        if (this.allDependentsIds.has(elementId)) {
            return true;
        }

        const element = index.find(elementId);
        if (!element) {
            this.logger.warn('Element not found: ' + elementId);
            return false;
        }

        if (!element.parent) {
            this.logger.warn("The requested element doesn't have a parent; it can't be deleted");
            return false;
        }

        const dependents = new Set<GModelElement>();
        this.collectDependents(dependents, element, false);

        dependents.forEach(dependant => {
            const index = dependant.parent.children.findIndex(element => element === dependant);
            if (index > -1) {
                dependant.parent.children.splice(index, 1);
            }
            this.allDependentsIds.add(dependant.id);
        });

        return true;
    }

    protected collectDependents(dependents: Set<GModelElement>, elementToDelete: GModelElement, isChild: boolean): void {
        if (dependents.has(elementToDelete)) {
            return;
        }

        if (elementToDelete.children.length > 0) {
            elementToDelete.children.forEach(child => this.collectDependents(dependents, child, true));
        }

        if (elementToDelete instanceof GNode || elementToDelete instanceof GPort) {
            const index = this.modelState.index;

            index.getIncomingEdges(elementToDelete).forEach(incoming => {
                dependents.add(incoming);
            });
            index.getOutgoingEdges(elementToDelete).forEach(outgoing => {
                dependents.add(outgoing);
            });
        }
        if (!isChild) {
            dependents.add(elementToDelete);
        }
    }
}
