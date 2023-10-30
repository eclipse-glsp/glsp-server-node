import { 
    Action, 
    Bounds, 
    CloseSmartConnectorAction, 
    OpenSmartConnectorAction, 
    SelectAction, 
    MaybePromise, } from '@eclipse-glsp/protocol';
import { inject, injectable } from 'inversify';
import { ActionHandler } from '../../actions/action-handler';
import { ModelState } from '../model/model-state';
import { GNode } from '@eclipse-glsp/graph';

@injectable()
export class OpenSmartConnectorActionHandler implements ActionHandler {
    actionKinds = [SelectAction.KIND];

    @inject(ModelState)
    protected modelState: ModelState;

    execute(action: Action): MaybePromise<Action[]> {
        if (SelectAction.is(action)) {
            const selectedElement = this.modelState.index.find(action.selectedElementsIDs[0]);
            if (selectedElement && selectedElement instanceof GNode) {
                var bounds: Bounds = {
                    x: selectedElement.position.x,
                    y: selectedElement.position.y,
                    width: selectedElement.size.width,
                    height: selectedElement.size.height
                }
                return [OpenSmartConnectorAction.create(action.selectedElementsIDs[0], bounds)];           
            }
        }
        return [CloseSmartConnectorAction.create()];
    }
}