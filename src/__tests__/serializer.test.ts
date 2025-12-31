/**
 * Tests for serializer utility functions.
 *
 * Covers:
 * - Primitive types
 * - Objects and arrays
 * - Date handling
 * - Circular reference detection
 * - Special values (NaN, Infinity, BigInt)
 * - Error objects
 * - Map and Set
 * - ChatML detection
 * - Function argument serialization
 */

import { describe, it, expect } from 'vitest';
import {
  serializeValue,
  serialize,
  serializeWithMime,
  serializeFunctionArgs,
  isChatMLFormat,
} from '../utils/serializer';

describe('serializeValue', () => {
  describe('primitives', () => {
    it('should handle null', () => {
      expect(serializeValue(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(serializeValue(undefined)).toBe(null);
    });

    it('should handle strings', () => {
      expect(serializeValue('hello')).toBe('hello');
      expect(serializeValue('')).toBe('');
      expect(serializeValue('Hello 世界 🌍')).toBe('Hello 世界 🌍');
    });

    it('should handle numbers', () => {
      expect(serializeValue(42)).toBe(42);
      expect(serializeValue(-100)).toBe(-100);
      expect(serializeValue(3.14)).toBe(3.14);
      expect(serializeValue(0)).toBe(0);
    });

    it('should handle booleans', () => {
      expect(serializeValue(true)).toBe(true);
      expect(serializeValue(false)).toBe(false);
    });
  });

  describe('special numbers', () => {
    it('should handle NaN', () => {
      expect(serializeValue(NaN)).toBe('NaN');
    });

    it('should handle Infinity', () => {
      expect(serializeValue(Infinity)).toBe('Infinity');
      expect(serializeValue(-Infinity)).toBe('-Infinity');
    });
  });

  describe('BigInt', () => {
    it('should convert BigInt to string', () => {
      expect(serializeValue(BigInt(12345678901234567890n))).toBe('12345678901234567890');
    });
  });

  describe('Symbol', () => {
    it('should convert Symbol to placeholder string', () => {
      const result = serializeValue(Symbol('test'));
      expect(result).toBe('<symbol:test>');
    });

    it('should handle anonymous Symbol', () => {
      const result = serializeValue(Symbol());
      expect(result).toMatch(/<symbol:/);
    });
  });

  describe('Function', () => {
    it('should convert Function to placeholder string', () => {
      function myFunc() {}
      const result = serializeValue(myFunc);
      expect(result).toBe('<function:myFunc>');
    });

    it('should handle anonymous function', () => {
      const result = serializeValue(() => {});
      expect(result).toMatch(/<function:/);
    });
  });

  describe('objects', () => {
    it('should handle plain objects', () => {
      const obj = { name: 'test', value: 42 };
      expect(serializeValue(obj)).toEqual({ name: 'test', value: 42 });
    });

    it('should handle nested objects', () => {
      const obj = { level1: { level2: { level3: 'deep' } } };
      expect(serializeValue(obj)).toEqual({ level1: { level2: { level3: 'deep' } } });
    });

    it('should handle empty objects', () => {
      expect(serializeValue({})).toEqual({});
    });
  });

  describe('arrays', () => {
    it('should handle arrays', () => {
      expect(serializeValue([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should handle mixed arrays', () => {
      expect(serializeValue(['a', 1, true, null])).toEqual(['a', 1, true, null]);
    });

    it('should handle empty arrays', () => {
      expect(serializeValue([])).toEqual([]);
    });
  });

  describe('Date', () => {
    it('should convert Date to ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(serializeValue(date)).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('Error', () => {
    it('should serialize Error objects', () => {
      const error = new Error('Something went wrong');
      const result = serializeValue(error) as Record<string, unknown>;
      expect(result.type).toBe('Error');
      expect(result.message).toBe('Something went wrong');
      expect(result.stack).toBeDefined();
    });

    it('should handle custom Error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error');
      const result = serializeValue(error) as Record<string, unknown>;
      expect(result.type).toBe('CustomError');
    });
  });

  describe('RegExp', () => {
    it('should convert RegExp to string', () => {
      expect(serializeValue(/test/gi)).toBe('/test/gi');
    });
  });

  describe('Map', () => {
    it('should convert Map to object', () => {
      const map = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);
      expect(serializeValue(map)).toEqual({ a: 1, b: 2 });
    });
  });

  describe('Set', () => {
    it('should convert Set to array', () => {
      const set = new Set([1, 2, 3]);
      expect(serializeValue(set)).toEqual([1, 2, 3]);
    });
  });

  describe('TypedArray', () => {
    it('should convert Uint8Array to array', () => {
      const arr = new Uint8Array([1, 2, 3]);
      expect(serializeValue(arr)).toEqual([1, 2, 3]);
    });
  });

  describe('circular references', () => {
    it('should detect circular references', () => {
      const obj: Record<string, unknown> = { key: 'value' };
      obj['self'] = obj;
      const result = serializeValue(obj) as Record<string, unknown>;
      expect(result.key).toBe('value');
      expect(result.self).toBe('<circular reference>');
    });

    it('should handle nested circular references', () => {
      const a: Record<string, unknown> = { name: 'a' };
      const b: Record<string, unknown> = { name: 'b', ref: a };
      a['ref'] = b;
      const result = serializeValue(a) as Record<string, unknown>;
      expect(result.name).toBe('a');
      expect((result.ref as Record<string, unknown>).name).toBe('b');
    });
  });

  describe('toJSON method', () => {
    it('should use toJSON method if available', () => {
      const obj = {
        value: 42,
        toJSON() {
          return { serialized: true, val: this.value };
        },
      };
      expect(serializeValue(obj)).toEqual({ serialized: true, val: 42 });
    });
  });
});

describe('serialize', () => {
  it('should return null for null input', () => {
    expect(serialize(null)).toBe(null);
  });

  it('should return null for undefined input', () => {
    expect(serialize(undefined)).toBe(null);
  });

  it('should return string as-is', () => {
    expect(serialize('hello')).toBe('hello');
  });

  it('should JSON stringify objects', () => {
    expect(serialize({ key: 'value' })).toBe('{"key":"value"}');
  });

  it('should JSON stringify arrays', () => {
    expect(serialize([1, 2, 3])).toBe('[1,2,3]');
  });
});

describe('serializeWithMime', () => {
  it('should handle null with application/json', () => {
    const [value, mime] = serializeWithMime(null);
    expect(value).toBe('null');
    expect(mime).toBe('application/json');
  });

  it('should handle undefined with application/json', () => {
    const [value, mime] = serializeWithMime(undefined);
    expect(value).toBe('null');
    expect(mime).toBe('application/json');
  });

  it('should handle string with text/plain', () => {
    const [value, mime] = serializeWithMime('hello world');
    expect(value).toBe('hello world');
    expect(mime).toBe('text/plain');
  });

  it('should handle number with text/plain', () => {
    const [value, mime] = serializeWithMime(42);
    expect(value).toBe('42');
    expect(mime).toBe('text/plain');
  });

  it('should handle boolean with text/plain', () => {
    const [value, mime] = serializeWithMime(true);
    expect(value).toBe('true');
    expect(mime).toBe('text/plain');
  });

  it('should handle object with application/json', () => {
    const [value, mime] = serializeWithMime({ key: 'value' });
    expect(value).toBe('{"key":"value"}');
    expect(mime).toBe('application/json');
  });

  it('should handle array with application/json', () => {
    const [value, mime] = serializeWithMime([1, 2, 3]);
    expect(value).toBe('[1,2,3]');
    expect(mime).toBe('application/json');
  });

  it('should handle BigInt with text/plain', () => {
    const [value, mime] = serializeWithMime(BigInt(12345));
    expect(value).toBe('12345');
    expect(mime).toBe('text/plain');
  });
});

describe('isChatMLFormat', () => {
  it('should detect valid ChatML format', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];
    expect(isChatMLFormat(messages)).toBe(true);
  });

  it('should detect ChatML with system message', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];
    expect(isChatMLFormat(messages)).toBe(true);
  });

  it('should detect ChatML with tool calls', () => {
    const messages = [
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: '1', type: 'function', function: { name: 'test' } }],
      },
    ];
    expect(isChatMLFormat(messages)).toBe(true);
  });

  it('should reject non-array', () => {
    expect(isChatMLFormat({ role: 'user', content: 'Hello' })).toBe(false);
  });

  it('should reject empty array', () => {
    expect(isChatMLFormat([])).toBe(false);
  });

  it('should reject array without role property', () => {
    expect(isChatMLFormat([{ content: 'Hello' }])).toBe(false);
  });

  it('should reject array of non-objects', () => {
    expect(isChatMLFormat(['string', 'items'])).toBe(false);
  });

  it('should reject null', () => {
    expect(isChatMLFormat(null)).toBe(false);
  });

  it('should reject string', () => {
    expect(isChatMLFormat('not messages')).toBe(false);
  });
});

describe('serializeFunctionArgs', () => {
  it('should serialize with parameter names', () => {
    const result = serializeFunctionArgs(['arg1', 42], ['param1', 'param2']);
    expect(result).toEqual({ param1: 'arg1', param2: 42 });
  });

  it('should use generic keys without parameter names', () => {
    const result = serializeFunctionArgs(['a', 'b', 'c']);
    expect(result).toEqual({ arg_0: 'a', arg_1: 'b', arg_2: 'c' });
  });

  it('should handle mixed args with partial param names', () => {
    const result = serializeFunctionArgs(['a', 'b', 'c'], ['first']);
    expect(result).toEqual({ first: 'a', arg_1: 'b', arg_2: 'c' });
  });

  it('should serialize complex argument types', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = serializeFunctionArgs([{ key: 'value' }, date], ['config', 'timestamp']);
    expect(result).toEqual({
      config: { key: 'value' },
      timestamp: '2024-01-15T10:30:00.000Z',
    });
  });

  it('should handle empty args', () => {
    const result = serializeFunctionArgs([]);
    expect(result).toEqual({});
  });
});
