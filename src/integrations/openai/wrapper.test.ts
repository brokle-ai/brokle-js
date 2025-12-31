/**
 * Tests for OpenAI wrapper
 *
 * Covers:
 * - Symbol handling (critical bug fix)
 * - Proxy pattern correctness
 * - API structure preservation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { wrapOpenAI } from './wrapper';

describe('OpenAI Wrapper', () => {
  beforeAll(() => {
    // Set required environment variable for testing
    process.env.BROKLE_API_KEY = 'bk_' + 'x'.repeat(40);
  });

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

  describe('Wrapper Integration', () => {
    it('should wrap OpenAI client without errors', () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
        completions: {
          create: async () => ({ id: 'test', choices: [] }),
        },
        embeddings: {
          create: async () => ({ data: [], usage: {} }),
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);
      expect(wrapped).toBeDefined();
      expect(wrapped.chat).toBeDefined();
      expect(wrapped.chat.completions).toBeDefined();
    });

    it('should preserve API structure after wrapping', () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);

      expect(typeof wrapped.chat.completions.create).toBe('function');
    });

    it('should handle Symbol.toStringTag on wrapped client', () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);

      // Regression test for Symbol bug
      expect(() => Object.prototype.toString.call(wrapped)).not.toThrow();
      expect(() => Object.prototype.toString.call(wrapped.chat)).not.toThrow();
      expect(() => Object.prototype.toString.call(wrapped.chat.completions)).not.toThrow();
    });

    it('should handle multiple levels of nesting', () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
        level1: {
          level2: {
            level3: {
              method: () => 'test',
            },
          },
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);

      expect(wrapped.level1).toBeDefined();
      expect(wrapped.level1.level2).toBeDefined();
      expect(wrapped.level1.level2.level3).toBeDefined();
      expect(wrapped.level1.level2.level3.method()).toBe('test');
    });

    it('should preserve non-function properties', () => {
      const mockClient = {
        baseURL: 'https://api.openai.com',
        apiKey: 'sk-test',
        organization: 'org-test',
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);

      expect(wrapped.baseURL).toBe('https://api.openai.com');
      expect(wrapped.apiKey).toBe('sk-test');
      expect(wrapped.organization).toBe('org-test');
    });

    it('should handle null and undefined properties', () => {
      const mockClient = {
        nullProp: null,
        undefinedProp: undefined,
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
      } as any;

      const wrapped = wrapOpenAI(mockClient);

      expect(wrapped.nullProp).toBeNull();
      expect(wrapped.undefinedProp).toBeUndefined();
    });

    it('should not modify original client', () => {
      const mockClient = {
        chat: {
          completions: {
            create: async () => ({ id: 'test', choices: [] }),
          },
        },
      } as any;

      const originalCreate = mockClient.chat.completions.create;
      const wrapped = wrapOpenAI(mockClient);

      // Original client should not be modified
      expect(mockClient.chat.completions.create).toBe(originalCreate);

      // Wrapped client should have different reference (proxied)
      expect(wrapped.chat.completions.create).not.toBe(originalCreate);
    });
  });

  describe('Runtime Validation', () => {
    it('should throw error for null client', () => {
      expect(() => wrapOpenAI(null as any)).toThrow(
        'wrapOpenAI requires an OpenAI client instance'
      );
    });

    it('should throw error for undefined client', () => {
      expect(() => wrapOpenAI(undefined as any)).toThrow(
        'wrapOpenAI requires an OpenAI client instance'
      );
    });

    it('should throw error for non-object client', () => {
      expect(() => wrapOpenAI('not-a-client' as any)).toThrow(
        'wrapOpenAI requires an OpenAI client instance'
      );
    });

    it('should throw error for client without chat.completions.create or completions.create', () => {
      const invalidClient = { someOtherMethod: () => {} } as any;
      expect(() => wrapOpenAI(invalidClient)).toThrow(
        'Invalid OpenAI client passed to wrapOpenAI'
      );
    });

    it('should accept client with only chat.completions.create', () => {
      const client = {
        chat: { completions: { create: async () => ({}) } },
      } as any;
      expect(() => wrapOpenAI(client)).not.toThrow();
    });

    it('should accept client with only completions.create', () => {
      const client = {
        completions: { create: async () => ({}) },
      } as any;
      expect(() => wrapOpenAI(client)).not.toThrow();
    });
  });
});
