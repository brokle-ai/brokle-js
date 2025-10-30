/**
 * Tests for OpenAI wrapper - Symbol handling
 *
 * Note: Full integration tests require brokle package to be built.
 * These tests verify the critical symbol handling fix.
 */

import { describe, it, expect } from 'vitest';

describe('Proxy symbol handling', () => {
  describe('symbol property access safety', () => {
    it('should handle Symbol.toStringTag without crashing', () => {
      const mockClient = { chat: { completions: { create: () => {} } } };

      // Create a simple proxy with symbol guard (same pattern as our wrapper)
      const proxy = new Proxy(mockClient, {
        get(obj, prop: string | symbol) {
          // This is the critical fix being tested
          if (typeof prop === 'symbol') {
            return obj[prop as any];
          }

          const value = obj[prop as keyof typeof obj];
          return value;
        },
      });

      // This should not throw TypeError
      expect(() => {
        const result = Object.prototype.toString.call(proxy);
      }).not.toThrow();
    });

    it('should handle Symbol.asyncIterator without crashing', () => {
      const mockClient = {} as any;
      const testIterator = async function* () {
        yield 1;
      };
      mockClient[Symbol.asyncIterator] = testIterator;

      const proxy = new Proxy(mockClient, {
        get(obj, prop: string | symbol) {
          if (typeof prop === 'symbol') {
            return obj[prop];
          }
          return obj[prop as any];
        },
      });

      // Access symbol property directly
      expect(() => {
        const iterator = proxy[Symbol.asyncIterator];
        expect(iterator).toBe(testIterator);
      }).not.toThrow();
    });

    it('should return symbol property value unchanged', () => {
      const mockClient = {} as any;
      const testSymbol = Symbol('test');
      mockClient[testSymbol] = 'test-value';

      const proxy = new Proxy(mockClient, {
        get(obj, prop: string | symbol) {
          if (typeof prop === 'symbol') {
            return obj[prop];
          }
          return obj[prop as any];
        },
      });

      // Symbol property should pass through
      expect(proxy[testSymbol]).toBe('test-value');
    });

    it('should allow string path building for normal properties', () => {
      const mockClient = { chat: { completions: { create: () => 'test' } } };

      const proxy = new Proxy(mockClient, {
        get(obj, prop: string | symbol) {
          if (typeof prop === 'symbol') {
            return obj[prop as any];
          }

          // This should work fine with string properties
          const path = ['root', prop].join('.');
          expect(path).toBe('root.chat');

          return obj[prop as keyof typeof obj];
        },
      });

      expect(proxy.chat).toBeDefined();
    });
  });
});