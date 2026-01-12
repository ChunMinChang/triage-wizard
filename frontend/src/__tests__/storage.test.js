/**
 * @fileoverview Tests for storage module (localStorage wrapper)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getConfig,
  setConfig,
  getAllConfig,
  removeConfig,
  clearAllConfig,
  KEY_PREFIX,
} from '../storage.js';

describe('storage module', () => {
  // Mock localStorage for testing
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockStorage[key] ?? null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
      get length() {
        return Object.keys(mockStorage).length;
      },
      key: vi.fn((index) => Object.keys(mockStorage)[index] ?? null),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('KEY_PREFIX', () => {
    it('should export KEY_PREFIX constant', () => {
      expect(KEY_PREFIX).toBe('btw_');
    });
  });

  describe('setConfig', () => {
    it('should store a string value', () => {
      const result = setConfig('testKey', 'testValue');
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_testKey', '"testValue"');
    });

    it('should store a number value', () => {
      const result = setConfig('numberKey', 42);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_numberKey', '42');
    });

    it('should store an object value', () => {
      const obj = { foo: 'bar', num: 123 };
      const result = setConfig('objectKey', obj);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_objectKey', JSON.stringify(obj));
    });

    it('should store an array value', () => {
      const arr = [1, 2, 3, 'four'];
      const result = setConfig('arrayKey', arr);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_arrayKey', JSON.stringify(arr));
    });

    it('should store boolean values', () => {
      expect(setConfig('boolTrue', true)).toBe(true);
      expect(setConfig('boolFalse', false)).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_boolTrue', 'true');
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_boolFalse', 'false');
    });

    it('should store null value', () => {
      const result = setConfig('nullKey', null);
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('btw_nullKey', 'null');
    });

    it('should return false when localStorage throws', () => {
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });
      const result = setConfig('failKey', 'value');
      expect(result).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should retrieve a stored string value', () => {
      mockStorage['btw_testKey'] = '"testValue"';
      const result = getConfig('testKey');
      expect(result).toBe('testValue');
    });

    it('should retrieve a stored number value', () => {
      mockStorage['btw_numberKey'] = '42';
      const result = getConfig('numberKey');
      expect(result).toBe(42);
    });

    it('should retrieve a stored object value', () => {
      const obj = { foo: 'bar', num: 123 };
      mockStorage['btw_objectKey'] = JSON.stringify(obj);
      const result = getConfig('objectKey');
      expect(result).toEqual(obj);
    });

    it('should retrieve a stored array value', () => {
      const arr = [1, 2, 3, 'four'];
      mockStorage['btw_arrayKey'] = JSON.stringify(arr);
      const result = getConfig('arrayKey');
      expect(result).toEqual(arr);
    });

    it('should retrieve boolean values', () => {
      mockStorage['btw_boolTrue'] = 'true';
      mockStorage['btw_boolFalse'] = 'false';
      expect(getConfig('boolTrue')).toBe(true);
      expect(getConfig('boolFalse')).toBe(false);
    });

    it('should return defaultValue when key not found', () => {
      const result = getConfig('nonexistent', 'default');
      expect(result).toBe('default');
    });

    it('should return null as default when no defaultValue provided', () => {
      const result = getConfig('nonexistent');
      expect(result).toBe(null);
    });

    it('should return defaultValue on JSON parse error', () => {
      mockStorage['btw_badJson'] = 'not valid json {';
      const result = getConfig('badJson', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should return defaultValue when localStorage throws', () => {
      localStorage.getItem = vi.fn(() => {
        throw new Error('SecurityError');
      });
      const result = getConfig('errorKey', 'default');
      expect(result).toBe('default');
    });
  });

  describe('getAllConfig', () => {
    it('should return empty object when no config stored', () => {
      const result = getAllConfig();
      expect(result).toEqual({});
    });

    it('should return all prefixed keys', () => {
      mockStorage['btw_key1'] = '"value1"';
      mockStorage['btw_key2'] = '42';
      mockStorage['other_key'] = '"ignored"'; // Not prefixed

      const result = getAllConfig();
      expect(result).toEqual({
        key1: 'value1',
        key2: 42,
      });
    });

    it('should handle mixed value types', () => {
      mockStorage['btw_str'] = '"string"';
      mockStorage['btw_num'] = '123';
      mockStorage['btw_obj'] = '{"nested":"value"}';
      mockStorage['btw_arr'] = '[1,2,3]';
      mockStorage['btw_bool'] = 'true';

      const result = getAllConfig();
      expect(result).toEqual({
        str: 'string',
        num: 123,
        obj: { nested: 'value' },
        arr: [1, 2, 3],
        bool: true,
      });
    });

    it('should skip keys with invalid JSON', () => {
      mockStorage['btw_valid'] = '"good"';
      mockStorage['btw_invalid'] = 'bad json {';

      const result = getAllConfig();
      expect(result).toEqual({
        valid: 'good',
      });
    });
  });

  describe('removeConfig', () => {
    it('should remove a stored key', () => {
      mockStorage['btw_toRemove'] = '"value"';
      const result = removeConfig('toRemove');
      expect(result).toBe(true);
      expect(localStorage.removeItem).toHaveBeenCalledWith('btw_toRemove');
    });

    it('should return true even if key does not exist', () => {
      const result = removeConfig('nonexistent');
      expect(result).toBe(true);
    });

    it('should return false when localStorage throws', () => {
      localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError');
      });
      const result = removeConfig('errorKey');
      expect(result).toBe(false);
    });
  });

  describe('clearAllConfig', () => {
    it('should remove all prefixed keys', () => {
      mockStorage['btw_key1'] = '"value1"';
      mockStorage['btw_key2'] = '"value2"';
      mockStorage['other_key'] = '"preserved"'; // Not prefixed

      const result = clearAllConfig();
      expect(result).toBe(true);
      expect(localStorage.removeItem).toHaveBeenCalledWith('btw_key1');
      expect(localStorage.removeItem).toHaveBeenCalledWith('btw_key2');
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('other_key');
    });

    it('should return true when no keys to clear', () => {
      const result = clearAllConfig();
      expect(result).toBe(true);
    });

    it('should return false when localStorage throws', () => {
      mockStorage['btw_key'] = '"value"';
      localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError');
      });
      const result = clearAllConfig();
      expect(result).toBe(false);
    });
  });

  describe('localStorage unavailable', () => {
    beforeEach(() => {
      vi.stubGlobal('localStorage', undefined);
    });

    it('getConfig should return defaultValue', () => {
      expect(getConfig('key', 'default')).toBe('default');
    });

    it('setConfig should return false', () => {
      expect(setConfig('key', 'value')).toBe(false);
    });

    it('getAllConfig should return empty object', () => {
      expect(getAllConfig()).toEqual({});
    });

    it('removeConfig should return false', () => {
      expect(removeConfig('key')).toBe(false);
    });

    it('clearAllConfig should return false', () => {
      expect(clearAllConfig()).toBe(false);
    });
  });

  describe('round-trip tests', () => {
    it('should preserve data through set and get cycle', () => {
      const testCases = [
        { key: 'string', value: 'hello world' },
        { key: 'number', value: 3.14159 },
        { key: 'negative', value: -42 },
        { key: 'zero', value: 0 },
        { key: 'object', value: { a: 1, b: { c: 2 } } },
        { key: 'array', value: [1, 'two', { three: 3 }] },
        { key: 'bool', value: true },
        { key: 'null', value: null },
        { key: 'emptyString', value: '' },
        { key: 'emptyArray', value: [] },
        { key: 'emptyObject', value: {} },
      ];

      for (const { key, value } of testCases) {
        setConfig(key, value);
        const retrieved = getConfig(key);
        expect(retrieved).toEqual(value);
      }
    });
  });
});
