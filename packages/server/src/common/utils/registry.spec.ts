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
import { MultiRegistry, Registry } from './registry';
import { expect } from 'chai';

describe('Test Registry', () => {
    let registry: Registry<string, string>;

    beforeEach(() => {
        registry = new Registry();
    });

    it('register - with new key-value pair', () => {
        const key = 'key';
        const value = 'value';
        expect(registry.register(key, value)).true;
        expect(registry.get(key), value);
    });

    it('register -  with key-value pair with a already registered key', () => {
        // Setup
        const key = 'key';
        const value = 'value';
        expect(registry.register(key, value)).true;
        // Test execution
        expect(registry.register(key, 'newValue')).false;
        expect(registry.get(key), value);
    });

    it('deregister - with registered key', () => {
        // Setup
        const key = 'key';
        const value = 'value';
        expect(registry.register(key, value)).true;
        // Test execution
        expect(registry.deregister(key)).true;
        expect(registry.get(key), undefined);
    });

    it('deregister - with unregistered key', () => {
        expect(registry.deregister('unregisteredKey')).false;
    });

    it('haskey - with registered key', () => {
        // Setup
        const key = 'key';
        const value = 'value';
        expect(registry.register(key, value)).true;
        // Test execution
        expect(registry.hasKey(key)).true;
    });

    it('haskey - with unregistered key', () => {
        expect(registry.deregister('unregisteredKey')).false;
    });

    it('get - with registered key', () => {
        // Setup
        const key = 'key';
        const value = 'value';
        expect(registry.register(key, value)).true;
        // Test execution
        expect(registry.get(key), value);
    });

    it('get - with unregistered key', () => {
        expect(registry.get('unregisteredKey'), undefined);
    });

    it('getAll - should return three values', () => {
        // Setup
        const e1 = { key: 'key1', value: 'value1' };
        const e2 = { key: 'key2', value: 'value2' };
        const e3 = { key: 'key3', value: 'value3' };
        registry.register(e1.key, e1.value);
        registry.register(e2.key, e2.value);
        registry.register(e3.key, e3.value);
        // Test execution
        const result = registry.getAll();
        expect(result).to.have.length(3);
        expect(result.includes(e1.value)).true;
        expect(result.includes(e2.value)).true;
        expect(result.includes(e3.value)).true;
    });

    it('keys - should return three keys', () => {
        // Setup
        const e1 = { key: 'key1', value: 'value1' };
        const e2 = { key: 'key2', value: 'value2' };
        const e3 = { key: 'key3', value: 'value3' };
        registry.register(e1.key, e1.value);
        registry.register(e2.key, e2.value);
        registry.register(e3.key, e3.value);
        // Test execution
        const result = registry.keys();
        expect(result).to.have.length(3);
        expect(result.includes(e1.key)).true;
        expect(result.includes(e2.key)).true;
        expect(result.includes(e3.key)).true;
    });
});

describe('Test MapMultiRegistry', () => {
    let multiRegistry: MultiRegistry<string, string>;

    beforeEach(() => {
        multiRegistry = new MultiRegistry();
    });

    it('register - with new key-value pair', () => {
        // Setup
        const e1 = { key: 'key', value: 'value' };
        const e2 = { key: e1.key, value: 'value2' };

        multiRegistry.register(e1.key, e1.value);
        multiRegistry.register(e2.key, e2.value);

        const resultValue = multiRegistry.get(e1.key);
        expect(resultValue).to.not.be.undefined;
        expect(resultValue!.length).to.be.equal(2);
        expect(resultValue!.includes(e1.value)).true;
        expect(resultValue!.includes(e2.value)).true;
    });

    it('deregister - with registered key', () => {
        // Setup
        const key = 'key';
        const existingValue = ['value', 'value2'];
        multiRegistry.register(key, existingValue[0]);
        multiRegistry.register(key, existingValue[1]);
        // Test execution
        expect(multiRegistry.deregister(key, existingValue[1])).true;
        const result = multiRegistry.get(key);
        expect(result.length).to.be.equal(1);
        expect(result[0], existingValue[0]);
    });

    it('deregister - with unregistered key', () => {
        expect(multiRegistry.deregister('unregisteredKey', 'someValue')).false;
    });

    it('deregisterAll - with registered key', () => {
        // Setup
        const key = 'key';
        const existingValue = ['value', 'value2'];
        multiRegistry.register(key, existingValue[0]);
        multiRegistry.register(key, existingValue[1]);
        expect(multiRegistry.deregisterAll(key)).true;
        expect(multiRegistry.get(key)).to.have.length(0);
    });

    it('deregisterAll - with unregistered key', () => {
        expect(multiRegistry.deregisterAll('unregisteredKey')).false;
    });

    it('haskey - with registered key', () => {
        // Setup
        const key = 'key';
        const existingValue = 'value';
        multiRegistry.register(key, existingValue);
        // Test execution
        expect(multiRegistry.hasKey(key)).true;
    });

    it('haskey - with unregistered key', () => {
        expect(multiRegistry.hasKey('unregisteredKey')).false;
    });

    it('get - with registered key', () => {
        // Setup
        const key = 'key';
        const existingValue = 'value';
        multiRegistry.register(key, existingValue);
        // Test execution
        expect(multiRegistry.get(key).length).to.be.equal(1);
        expect(multiRegistry.get(key).includes(existingValue)).true;
    });

    it('get - with unregistered key', () => {
        expect(multiRegistry.get('unregisteredKey')).to.have.length(0);
    });

    it('getAll', () => {
        // Setup
        const e1 = { key: 'key1', value: ['value1', 'value2'] };
        const e2 = { key: 'key2', value: ['value3'] };
        multiRegistry.register(e1.key, e1.value[0]);
        multiRegistry.register(e1.key, e1.value[1]);
        multiRegistry.register(e2.key, e2.value[0]);
        // Test execution
        const result = multiRegistry.getAll();
        expect(result).to.have.length(3);
        expect(e1.value.every(v => result.includes(v))).true;
        expect(e2.value.every(v => result.includes(v))).true;
    });

    it('keys', () => {
        // Setup
        const e1 = { key: 'key1', value: ['value1', 'value2'] };
        const e2 = { key: 'key2', value: ['value3'] };
        multiRegistry.register(e1.key, e1.value[0]);
        multiRegistry.register(e1.key, e1.value[1]);
        multiRegistry.register(e2.key, e2.value[0]);
        // Test execution
        const result = multiRegistry.keys();
        expect(result.length).to.be.equal(2);
        expect(result.includes(e1.key)).true;
        expect(result.includes(e2.key)).true;
    });
});
