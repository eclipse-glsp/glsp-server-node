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
export class JsonOpenerOptions {
    selection: TextSelection;

    constructor(selection?: TextSelection) {
        if (selection) {
            this.selection = selection;
        }
    }

    public toString(): string {
        return `JsonOpenerOptions [selection=${this.selection}]`;
    }

    public toJson(): string {
        return JsonOpenerOptions.toJson(this);
    }

    public static toJson(options: JsonOpenerOptions): string {
        return JSON.stringify(options);
    }

    public static fromJson(options: string): JsonOpenerOptions | undefined {
        const parsed = JSON.parse(options);
        return parsed instanceof JsonOpenerOptions ? parsed : undefined;
    }
}

export class TextSelection {
    start: LinePosition;
    end: LinePosition;

    constructor(start: LinePosition, end: LinePosition) {
        this.start = start;
        this.end = end;
    }

    public toString(): string {
        return `TextSelection [start=${this.start}, end=${this.end}]`;
    }
}

export class LinePosition {
    line: number;
    character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    public toString(): string {
        return `LinePosition [line=${this.line}, character=${this.character}]`;
    }
}
