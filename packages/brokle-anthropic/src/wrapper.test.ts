/**
 * Tests for Anthropic wrapper
 *
 * Covers:
 * - Symbol handling (critical bug fix)
 * - Proxy pattern correctness
 * - API structure preservation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { wrapAnthropic } from './wrapper';

describe('Anthropic Wrapper', () => {
  beforeAll(() => {
    // Set required environment variable for testing
    process.env.BROKLE_API_KEY = 'bk_' + 'x'.repeat(40);
  });

  describe('Proxy symbol handling', () => {
  describe('symbol property access safety', () => {
    it('should handle Symbol.toStringTag without crashing', () => {
      const mockClient = { messages: { create: () => {} } };

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
      const mockClient = { messages: { create: () => 'test' } };

      const proxy = new Proxy(mockClient, {
        get(obj, prop: string | symbol) {
          if (typeof prop === 'symbol') {
            return obj[prop as any];
          }

          // This should work fine with string properties
          const path = ['root', prop].join('.');
          expect(path).toBe('root.messages');

          return obj[prop as keyof typeof obj];
        },
      });

      expect(proxy.messages).toBeDefined();
    });
  });
  });

  describe('Wrapper Integration', () => {
    it('should wrap Anthropic client without errors', () => {
      const mockClient = {
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [{ type: 'text', text: 'test' }],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);
      expect(wrapped).toBeDefined();
      expect(wrapped.messages).toBeDefined();
      expect(wrapped.messages.create).toBeDefined();
    });

    it('should preserve API structure after wrapping', () => {
      const mockClient = {
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);

      expect(typeof wrapped.messages.create).toBe('function');
    });

    it('should handle Symbol.toStringTag on wrapped client', () => {
      const mockClient = {
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);

      // Regression test for Symbol bug
      expect(() => Object.prototype.toString.call(wrapped)).not.toThrow();
      expect(() => Object.prototype.toString.call(wrapped.messages)).not.toThrow();
    });

    it('should handle multiple levels of nesting', () => {
      const mockClient = {
        level1: {
          level2: {
            level3: {
              method: () => 'test',
            },
          },
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);

      expect(wrapped.level1).toBeDefined();
      expect(wrapped.level1.level2).toBeDefined();
      expect(wrapped.level1.level2.level3).toBeDefined();
      expect(wrapped.level1.level2.level3.method()).toBe('test');
    });

    it('should preserve non-function properties', () => {
      const mockClient = {
        apiKey: 'sk-ant-test',
        baseURL: 'https://api.anthropic.com',
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);

      expect(wrapped.apiKey).toBe('sk-ant-test');
      expect(wrapped.baseURL).toBe('https://api.anthropic.com');
    });

    it('should handle null and undefined properties', () => {
      const mockClient = {
        nullProp: null,
        undefinedProp: undefined,
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const wrapped = wrapAnthropic(mockClient);

      expect(wrapped.nullProp).toBeNull();
      expect(wrapped.undefinedProp).toBeUndefined();
    });

    it('should not modify original client', () => {
      const mockClient = {
        messages: {
          create: async () => ({
            id: 'msg_test',
            content: [],
            model: 'claude-3-opus',
            role: 'assistant',
          }),
        },
      } as any;

      const originalCreate = mockClient.messages.create;
      const wrapped = wrapAnthropic(mockClient);

      // Original client should not be modified
      expect(mockClient.messages.create).toBe(originalCreate);

      // Wrapped client should have different reference (proxied)
      expect(wrapped.messages.create).not.toBe(originalCreate);
    });
  });
});