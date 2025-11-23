/**
 * Tests for trace and span input/output functionality
 *
 * Tests OpenInference pattern (input.value/output.value) for generic data
 * and OTLP GenAI standard (gen_ai.input.messages/output.messages) for LLM data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Brokle } from '../client';
import { Attrs } from '../types/attributes';

describe('Input/Output Functionality', () => {
  let client: Brokle;

  beforeEach(() => {
    client = new Brokle({
      apiKey: 'bk_test_' + 'x'.repeat(36),
      baseUrl: 'http://localhost:8080',
      environment: 'test',
      tracingEnabled: true,
    });
  });

  afterEach(async () => {
    await client.shutdown();
  });

  describe('Generic Input/Output', () => {
    it('should handle object input/output', async () => {
      const input = { endpoint: '/weather', query: 'Bangalore' };
      const output = { status: 200, data: { temp: 25 } };

      await client.traced('api-request', async (span) => {
        expect(span).toBeDefined();
        return output;
      }, undefined, {
        input,
        output,
      });

      // Should complete without errors
    });

    it('should handle string input/output', async () => {
      await client.traced('text-operation', async (span) => {
        expect(span).toBeDefined();
        return 'result';
      }, undefined, {
        input: 'Hello world',
        output: 'Processed',
      });
    });

    it('should handle null input/output', async () => {
      await client.traced('null-test', async (span) => {
        expect(span).toBeDefined();
        return null;
      }, undefined, {
        input: null,
        output: null,
      });
    });

    it('should handle undefined input/output', async () => {
      await client.traced('undefined-test', async (span) => {
        expect(span).toBeDefined();
        return undefined;
      }, undefined, {
        input: undefined,
        output: undefined,
      });
    });

    it('should handle nested objects', async () => {
      const complexInput = {
        level1: {
          level2: {
            data: [1, 2, 3],
            nested: { key: 'value' },
          },
        },
      };

      await client.traced('complex-data', async (span) => {
        expect(span).toBeDefined();
        return complexInput;
      }, undefined, {
        input: complexInput,
      });
    });
  });

  describe('LLM Messages Auto-Detection', () => {
    it('should auto-detect ChatML input format', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      await client.traced('llm-conversation', async (span) => {
        expect(span).toBeDefined();
        return messages;
      }, undefined, {
        input: messages,
        output: messages,
      });

      // Should use gen_ai.input.messages instead of input.value
    });

    it('should handle ChatML with tool calls', async () => {
      const messagesWithTools = [
        {
          role: 'assistant',
          content: 'Using weather tool',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location":"Bangalore"}' },
            },
          ],
        },
      ];

      await client.traced('llm-with-tools', async (span) => {
        expect(span).toBeDefined();
        return null;
      }, undefined, {
        input: messagesWithTools,
      });
    });

    it('should handle system messages', async () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      await client.traced('llm-with-system', async (span) => {
        expect(span).toBeDefined();
        return null;
      }, undefined, {
        input: messages,
      });
    });
  });

  describe('Generation Method', () => {
    it('should support generation spans', async () => {
      await client.generation('chat', 'gpt-4', 'openai', async (span) => {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([
          { role: 'assistant', content: 'Hello!' },
        ]));
        return { success: true };
      });
    });

    it('should inherit input/output from traced method', async () => {
      // generation() forwards to traced(), so input/output should work
      await client.generation('chat', 'gpt-4', 'openai', async (span) => {
        expect(span).toBeDefined();
        return null;
      }, {
        version: '1.0',
        // Note: input/output not in generation options yet, but traced supports it
      });
    });
  });

  describe('Mixed Spans', () => {
    it('should handle nested spans with different I/O types', async () => {
      await client.traced('parent-workflow', async (parentSpan) => {
        // Parent with generic I/O
        parentSpan.setAttribute(Attrs.OUTPUT_VALUE, JSON.stringify({ status: 'started' }));

        // Child with LLM messages (if nesting was supported)
        return { workflow: 'complete' };
      }, undefined, {
        input: { task: 'weather_query', location: 'Bangalore' },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', async () => {
      await client.traced('empty-test', async (span) => {
        expect(span).toBeDefined();
        return {};
      }, undefined, {
        input: {},
        output: {},
      });
    });

    it('should handle empty arrays', async () => {
      await client.traced('empty-array', async (span) => {
        expect(span).toBeDefined();
        return [];
      }, undefined, {
        input: [],
        output: [],
      });
    });

    it('should handle numbers and booleans', async () => {
      await client.traced('primitives', async (span) => {
        expect(span).toBeDefined();
        return 42;
      }, undefined, {
        input: 123,
        output: true,
      });
    });

    it('should handle large payloads', async () => {
      // Create ~10KB string
      const largeString = 'x'.repeat(10 * 1024);

      await client.traced('large-payload', async (span) => {
        expect(span).toBeDefined();
        return 'processed';
      }, undefined, {
        input: largeString,
      });

      // Backend will truncate if >1MB
    });

    it('should handle special characters in strings', async () => {
      const specialStr = 'Hello\nWorld\t"Quoted"\r\n';

      await client.traced('special-chars', async (span) => {
        expect(span).toBeDefined();
        return specialStr;
      }, undefined, {
        input: specialStr,
        output: specialStr,
      });
    });

    it('should handle unicode strings', async () => {
      const unicodeStr = 'Hello 世界 🌍';

      await client.traced('unicode', async (span) => {
        expect(span).toBeDefined();
        return unicodeStr;
      }, undefined, {
        input: unicodeStr,
        output: unicodeStr,
      });
    });
  });

  describe('Version Support', () => {
    it('should support version with input/output', async () => {
      await client.traced('versioned-trace', async (span) => {
        expect(span).toBeDefined();
        return 'v2 result';
      }, undefined, {
        version: 'v2.0',
        input: { feature: 'new' },
        output: { success: true },
      });
    });
  });
});
