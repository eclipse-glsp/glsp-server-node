import { 
    Action, 
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
                return [OpenSmartConnectorAction.create(action.selectedElementsIDs[0])];           
            }
            else return []
        }
        return [CloseSmartConnectorAction.create()];
    }
}