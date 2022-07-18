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
import { Args, MaybePromise, NavigationTarget } from '@eclipse-glsp/protocol';
import { injectable } from 'inversify';
import { NavigationTargetResolution } from './navigation-target-resolution';

@injectable()
export abstract class NavigationTargetResolver {
    readonly INFO = 'info';
    readonly WARNING = 'warning';
    readonly ERROR = 'error';

    abstract resolve(navigationTarget: NavigationTarget): MaybePromise<NavigationTargetResolution>;

    createArgs(): Args {
        return {};
    }

    createArgsWithInfo(message: string): Args {
        const args = this.createArgs();
        this.addInfo(message, args);
        return args;
    }

    createArgsWithWarning(message: string): Args {
        const args = this.createArgs();
        this.addWarning(message, args);
        return args;
    }

    createArgsWithError(message: string): Args {
        const args = this.createArgs();
        this.addError(message, args);
        return args;
    }

    addInfo(message: string, args: Args): void {
        args[this.INFO] = message;
    }

    addWarning(message: string, args: Args): void {
        args[this.WARNING] = message;
    }

    addError(message: string, args: Args): void {
        args[this.ERROR] = message;
    }
}
