/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { GModelElement } from '@eclipse-glsp/graph';
import {
    AnyObject,
    Args,
    CreateEdgeOperation,
    CreateNodeOperation,
    GhostElement,
    MaybePromise,
    Point,
    TriggerEdgeCreationAction,
    TriggerNodeCreationAction,
    hasFunctionProp,
    hasObjectProp
} from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { Command } from '../command/command';
import { AbstractRecordingCommand } from '../command/recording-command';
import { ModelState } from '../features/model/model-state';
import { getRelativeLocation } from '../utils/layout-util';
import { CreateEdgeOperationHandler, CreateNodeOperationHandler } from './create-operation-handler';
import { OperationHandler } from './operation-handler';

/**
 * Helper interface for {@link ModelState} implementations of diagram languages that use a (serializable) JSON-based source model.
 * Has to be implemented in order to reuse the {@link JsonOperationHandler} API.
 */
export interface JsonModelState<JsonObject extends AnyObject = AnyObject> extends ModelState {
    readonly sourceModel: MaybePromise<JsonObject>;
    updateSourceModel(sourceModel: JsonObject): MaybePromise<void>;
}

export namespace JsonModelState {
    export function is(modelState: ModelState): modelState is JsonModelState {
        return hasObjectProp(modelState, 'sourceModel') && hasFunctionProp(modelState, 'updateSourceModel');
    }
}

/**
 * Simple base implementation of {@link AbstractRecordingCommand} that allows recording of changes made
 * to the `sourceModel` of the given {@link JsonModelState} during the given `doExecute` function
 */
export class JsonRecordingCommand<JsonObject extends AnyObject = AnyObject> extends AbstractRecordingCommand<JsonObject> {
    constructor(
        protected modelState: JsonModelState<JsonObject>,
        protected doExecute: () => MaybePromise<void>
    ) {
        super();
    }

    protected override getJsonObject(): MaybePromise<JsonObject> {
        return this.modelState.sourceModel;
    }

    protected override postChange(newModel: JsonObject): MaybePromise<void> {
        return this.modelState.updateSourceModel(newModel);
    }
}

/**
 * Reusable {@link OperationHandler} base implementation for diagram languages that use a (serializable) JSON-based source model.
 * To use this class (or its subclasses) the injected {@link ModelState} has to implement the {@link JsonModelState} interface.
 *
 */
@injectable()
export abstract class JsonOperationHandler extends OperationHandler {
    protected commandOf(runnable: () => MaybePromise<void>): Command {
        if (!JsonModelState.is(this.modelState)) {
            throw new Error('Cannot create command. The underlying model state does not implement the `JsonModelState` interface');
        }
        return new JsonRecordingCommand(this.modelState, runnable);
    }
}

/**
 * Reusable {@link CreateNodeOperationHandler} base implementation for diagram languages that use a (serializable) JSON-based source model.
 */
@injectable()
export abstract class JsonCreateNodeOperationHandler extends JsonOperationHandler implements CreateNodeOperationHandler {
    abstract elementTypeIds: string[];
    abstract override label: string;
    override readonly operationType = CreateNodeOperation.KIND;

    abstract override createCommand(operation: CreateNodeOperation): MaybePromise<Command | undefined>;

    getTriggerActions(): TriggerNodeCreationAction[] {
        return this.elementTypeIds.map(elementTypeId => this.createTriggerNodeCreationAction(elementTypeId));
    }

    protected createTriggerNodeCreationAction(elementTypeId: string): TriggerNodeCreationAction {
        return TriggerNodeCreationAction.create(elementTypeId, {
            ghostElement: this.createTriggerGhostElement(elementTypeId),
            args: this.createTriggerArgs(elementTypeId)
        });
    }

    protected createTriggerGhostElement(elementTypeId: string): GhostElement | undefined {
        return undefined;
    }

    protected createTriggerArgs(elementTypeId: string): Args | undefined {
        return undefined;
    }

    /**
     * Return the GModelElement that will contain the newly created node. It is usually
     * the target element ({@link CreateNodeOperation.containerId}), but could also
     * be e.g. an intermediate compartment, or even a different Node.
     *
     * @param operation
     * @return the GModelElement that will contain the newly created node.
     */
    getContainer(operation: CreateNodeOperation): GModelElement | undefined {
        const index = this.modelState.index;
        return operation.containerId ? index.get(operation.containerId) : undefined;
    }

    getLocation(operation: CreateNodeOperation): Point | undefined {
        return operation.location;
    }

    /**
     * Retrieves the diagram absolute location and the target container from the given {@link CreateNodeOperation}
     * and converts the absolute location to coordinates relative to the given container.
     *  Relative coordinates can only be retrieved if the given container element is part of
     * a hierarchy of {@link GBoundsAware} elements. This means each (recursive) parent element need to
     * implement {@link GBoundsAware}. If that is not the case this method returns `undefined`.
     * @param absoluteLocation The diagram absolute position.
     * @param container The container element.
     * @returns The relative position or `undefined`.
     */
    getRelativeLocation(operation: CreateNodeOperation): Point | undefined {
        const container = this.getContainer(operation) ?? this.modelState.root;
        const absoluteLocation = this.getLocation(operation) ?? Point.ORIGIN;
        return getRelativeLocation(absoluteLocation, container);
    }
}

/**
 * Reusable {@link CreateEdgeOperationHandler} base implementation for diagram languages that use a (serializable) JSON-based source model.
 */
@injectable()
export abstract class JsonCreateEdgeOperationHandler extends JsonOperationHandler implements CreateEdgeOperationHandler {
    abstract elementTypeIds: string[];
    abstract override label: string;
    override readonly operationType = CreateEdgeOperation.KIND;

    abstract override createCommand(operation: CreateEdgeOperation): MaybePromise<Command | undefined>;

    getTriggerActions(): TriggerEdgeCreationAction[] {
        return this.elementTypeIds.map(typeId => TriggerEdgeCreationAction.create(typeId));
    }
}
