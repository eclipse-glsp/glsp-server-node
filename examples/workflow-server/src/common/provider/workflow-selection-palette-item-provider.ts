/********************************************************************************
 * Copyright (c) 2023 Business Informatics Group (TU Wien) and others.
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
    DefaultSelectionPaletteItemProvider, SelectionPaletteSettings
} from '@eclipse-glsp/server';
import {
    SelectionPalettePosition,
    SelectionPaletteGroupUIType,
    DefaultTypes
} from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { ModelTypes } from '../util/model-types';

@injectable()
export class WorkflowSelectionPaletteItemProvider extends DefaultSelectionPaletteItemProvider {

    protected override selectionPaletteNodeSettings: SelectionPaletteSettings = {
        position: SelectionPalettePosition.Top,
        showTitle: true,
        submenu: false,
        showOnlyForChildren: SelectionPaletteGroupUIType.Labels
    };

    protected override selectionPaletteEdgeSettings: SelectionPaletteSettings = {
        position: SelectionPalettePosition.Right,
        showTitle: true,
        submenu: true
    };

    protected override nodeOperationFilter = {
        [ModelTypes.AUTOMATED_TASK]: [ModelTypes.WEIGHTED_EDGE, ModelTypes.AUTOMATED_TASK, ModelTypes.MANUAL_TASK,
            ModelTypes.ACTIVITY_NODE],
        [ModelTypes.MERGE_NODE]: [DefaultTypes.EDGE, ModelTypes.MERGE_NODE, ModelTypes.CATEGORY],
        [ModelTypes.FORK_NODE]: [DefaultTypes.EDGE, ModelTypes.FORK_NODE],
        [ModelTypes.CATEGORY]: [ModelTypes.WEIGHTED_EDGE, ModelTypes.FORK_NODE],
        [ModelTypes.JOIN_NODE]: [ModelTypes.AUTOMATED_TASK, ModelTypes.FORK_NODE, ModelTypes.JOIN_NODE]
    };

    protected override defaultEdge = DefaultTypes.EDGE;

    protected override edgeTypes = {
        [ModelTypes.AUTOMATED_TASK]: DefaultTypes.EDGE,
        [ModelTypes.MERGE_NODE]: DefaultTypes.EDGE
    };
}
