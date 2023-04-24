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
import { GModelElement } from '@eclipse-glsp/graph';
import { Marker, MarkersReason, MaybePromise } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';

export const ModelValidator = Symbol('ModelValidator');

/**
 * Validates a list of {@link GModelElement}s based on a set of validation rules and returns corresponding issue
 * {@link Marker}s.
 * An issue marker is a serializable description of the validation violation that can be visualized by the GLSP client.
 */
export interface ModelValidator {
    /**
     * Validates the given list of {@link GModelElement}s and returns a list of {@link Marker}s.
     *
     * @param elements The list of {@link GModelElement} to validate.
     * @param reason The reason for a validation request, such as "batch" or "live" validation.
     * @return A list of {@link Marker}s for the validated {@link GModelElement}s.
     */
    validate(elements: GModelElement[], reason?: string): MaybePromise<Marker[]>;
}

@injectable()
export abstract class AbstractModelValidator implements ModelValidator {
    validate(elements: GModelElement[], reason: string): Marker[] {
        const markers: Marker[] = [];
        for (const element of elements) {
            if (MarkersReason.LIVE === reason) {
                markers.push(...this.doLiveValidation(element));
            } else if (MarkersReason.BATCH === reason) {
                markers.push(...this.doBatchValidation(element));
            } else {
                markers.push(...this.doValidationForCustomReason(element));
            }
            if (element.children) {
                markers.push(...this.validate(element.children, reason));
            }
        }
        return markers;
    }

    /**
     * Perform the live validation rules for the given <code>element</code>.
     *
     * This will be invoked on start and after each operation for all elements.
     * Thus, the validation should be rather inexpensive.
     * There is no need to traverse through the children in this method as {@link #validate(List, String)} will invoke
     * this method for all children anyway.
     *
     * @param element The element to validate.
     * @return A list of {@link Marker}s for the validated {@link GModelElement}.
     */
    doLiveValidation(element: GModelElement): Marker[] {
        return [];
    }

    /**
     * Perform the batch validation rules for the given <code>element</code>.
     *
     * <p>
     * This will be invoked on demand by the client.
     * Thus, the validation can include more expensive validation rules.
     * There is no need to traverse through the children in this method as {@link #validate(List, String)} will invoke
     * this method for all children anyway.
     * </p>
     *
     * @param element The element to validate.
     * @return A list of {@link Marker}s for the validated {@link GModelElement}.
     */
    doBatchValidation(element: GModelElement): Marker[] {
        return [];
    }

    /**
     * Perform a validation for a custom <code>reason</code> with the given <code>element</code>.
     *
     * <p>
     * GLSP editors may add custom reasons for triggering a validation, other than <code>live</code> and
     * <code>batch</code>.
     * Validation requests that are not live or batch validations will be handled by this method.
     * There is no need to traverse through the children in this method as {@link #validate(List, String)} will invoke
     * this method for all children anyway.
     * </p>
     *
     * @param element The element to validate.
     * @return A list of {@link Marker}s for the validated {@link GModelElement}.
     */
    doValidationForCustomReason(element: GModelElement): Marker[] {
        return [];
    }
}
