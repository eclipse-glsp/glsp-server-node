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
import { remove } from '@eclipse-glsp/protocol/lib/utils/array-util';
import { injectable } from 'inversify';

/**
 * A registry manages a set of key-value pairs and provides query functionality. In GLSP this is typically used to
 * provide a convenience API for working with multi-injected instances e.g. action handlers or
 * operation handlers.
 *
 * @typeParam K Key type
 * @param V Value type
 */

@injectable()
export class Registry<K, V> {
    protected elements: Map<K, V> = new Map();
    /**
     * Registers a new key-value pair.
     *
     * @param key     The key object.
     * @param element The value object.
     * @returns `true` if the pair was registered successfully, `false` if another pair with the same key is already
     *         registered.
     */
    register(key: K, instance: V): boolean {
        if (!this.hasKey(key)) {
            this.elements.set(key, instance);
            return true;
        }
        return false;
    }

    /**
     * Removes the value with the given key from the registry.
     *
     * @param key The key of the value which should be removed.
     * @returns `true` if the value was removed successfully, `false` if no value was registered for the given key.
     */
    deregister(key: K): boolean {
        return this.elements.delete(key);
    }

    /**
     * Queries the registry to check whether a value for the given key is registered.
     *
     * @param key The key which should be checked.
     * @returns `true` if a key-value pair is registered for the given key, `false` otherwise.
     */
    hasKey(key: K): boolean {
        return this.elements.has(key);
    }

    /**
     * Retrieve the value for the given key.
     *
     * @param key The key whose value should be retrieved.
     * @returns The registered value or `undefined`. Is `undefined` if no value was registered for the given key.
     */
    get(key: K): V | undefined {
        return this.elements.get(key);
    }

    /**
     * Retrieve all registered values from the registry.
     *
     * @returns An array of all registered keys.
     */

    getAll(): V[] {
        return [...new Set(this.elements.values())];
    }

    /**
     * Retrieve all registered keys from the registry.
     *
     * @returns An array of all registered keys.
     */
    keys(): K[] {
        return [...new Set(this.elements.keys())];
    }
}

/**
 * A multi registry is used to manage a set of key-value pairs. The main difference to {@link Registry} is that
 * a multi registry doesn't enforce a 1-1 relation between key and value(s).
 * One key can be associated with multiple values.
 *
 *
 * @typeParam K  Type of the key
 * @param V Type of the values
 */
@injectable()
export class MultiRegistry<K, V> {
    protected elements: Map<K, V[]> = new Map();

    register(key: K, instance: V): void {
        const instances = this.elements.get(key);
        if (instances) {
            instances.push(instance);
        } else {
            this.elements.set(key, [instance]);
        }
    }

    deregister(key: K, element: V): boolean {
        const instances = this.elements.get(key);
        if (instances) {
            return remove(instances, element);
        }
        return false;
    }

    deregisterAll(key: K): boolean {
        return this.elements.delete(key);
    }

    get(key: K): V[] {
        const existingInstances = this.elements.get(key);
        if (existingInstances) {
            return [...new Set(existingInstances)];
        } else {
            return [];
        }
    }

    hasKey(key: K): boolean {
        return this.elements.has(key);
    }

    getAll(): V[] {
        const values: V[] = [];
        Array.from(this.elements.values()).forEach(instances => values.push(...instances));
        return [...new Set(values)];
    }

    keys(): K[] {
        return [...new Set(this.elements.keys())];
    }
}
