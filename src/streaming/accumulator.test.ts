/**
 * Unit tests for StreamingAccumulator
 *
 * Tests TTFT tracking, inter-token latency, content accumulation,
 * and OTEL attribute conversion.
 */

import { describe, it, expect, vi } from 'vitest';
import { StreamingAccumulator } from './accumulator';

describe('StreamingAccumulator', () => {
  describe('Basic Functionality', () => {
    it('should initialize with start time', () => {
      const startTime = Date.now();
      const accumulator = new StreamingAccumulator(startTime);

      expect(accumulator.content).toBe('');
      expect(accumulator.isFinalized).toBe(false);
    });

    it('should accumulate OpenAI chunks', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // Mock OpenAI chunk
      const chunk = {
        choices: [{ delta: { content: 'Hello' } }],
        model: 'gpt-4',
      };

      const content = accumulator.onChunk(chunk);
      expect(content).toBe('Hello');
      expect(accumulator.content).toBe('Hello');
    });

    it('should accumulate multiple chunks', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({ choices: [{ delta: { content: 'Hello' } }] });
      accumulator.onChunk({ choices: [{ delta: { content: ' ' } }] });
      accumulator.onChunk({ choices: [{ delta: { content: 'World' } }] });

      expect(accumulator.content).toBe('Hello World');
    });

    it('should handle Anthropic chunks', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // Mock Anthropic content_block_delta chunk
      const chunk = {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello' },
      };

      const content = accumulator.onChunk(chunk);
      expect(content).toBe('Hello');
      expect(accumulator.content).toBe('Hello');
    });

    it('should handle chunks without content', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // Chunk with no content (e.g., final chunk with usage only)
      const chunk = {
        choices: [{ delta: {} }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const content = accumulator.onChunk(chunk);
      expect(content).toBeUndefined();
      expect(accumulator.content).toBe('');
    });
  });

  describe('TTFT Tracking', () => {
    it('should track time to first token', async () => {
      const startTime = Date.now();
      const accumulator = new StreamingAccumulator(startTime);

      // Simulate delay before first token
      await new Promise(resolve => setTimeout(resolve, 100));

      accumulator.onChunk({ choices: [{ delta: { content: 'Hi' } }] });

      const result = accumulator.finalize();
      expect(result.ttftMs).toBeGreaterThan(90); // ~100ms
      expect(result.ttftMs).toBeLessThan(150); // Reasonable upper bound
    });

    it('should only set TTFT on first content chunk', async () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // First chunk
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'A' } }] });
      const firstTTFT = accumulator.ttftMs;

      // Second chunk (TTFT shouldn't change)
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'B' } }] });

      expect(accumulator.ttftMs).toBe(firstTTFT);
    });

    it('should return undefined TTFT if no content received', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // No content chunks
      accumulator.onChunk({ choices: [] });
      accumulator.onChunk({ model: 'gpt-4' });

      const result = accumulator.finalize();
      expect(result.ttftMs).toBeUndefined();
    });
  });

  describe('Inter-Token Latency', () => {
    it('should track latencies between tokens', async () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({ choices: [{ delta: { content: 'A' } }] });
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'B' } }] });
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'C' } }] });

      const result = accumulator.finalize();
      expect(result.interTokenLatencies).toHaveLength(2);
      expect(result.avgInterTokenLatencyMs).toBeGreaterThan(40);
      expect(result.avgInterTokenLatencyMs).toBeLessThan(70);
    });

    it('should not track ITL for first chunk', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({ choices: [{ delta: { content: 'Only' } }] });

      const result = accumulator.finalize();
      expect(result.interTokenLatencies).toHaveLength(0);
      expect(result.avgInterTokenLatencyMs).toBeUndefined();
    });

    it('should skip ITL for non-content chunks', async () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({ choices: [{ delta: { content: 'A' } }] });
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: {} }] }); // No content
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'B' } }] });

      const result = accumulator.finalize();
      // Should only have 1 latency (A to B, skipping empty chunk)
      expect(result.interTokenLatencies).toHaveLength(1);
    });
  });

  describe('Usage Extraction', () => {
    it('should extract OpenAI usage from chunk', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });

      const result = accumulator.finalize();
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('should handle Anthropic message_start event', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({
        type: 'message_start',
        message: {
          usage: { input_tokens: 15, output_tokens: 0 },
        },
      });

      const result = accumulator.finalize();
      expect(result.usage?.promptTokens).toBe(15);
      expect(result.usage?.completionTokens).toBe(0);
    });

    it('should merge Anthropic split token usage', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // message_start with input tokens
      accumulator.onChunk({
        type: 'message_start',
        message: {
          usage: { input_tokens: 15, output_tokens: 0 },
        },
      });

      // message_delta with output tokens
      accumulator.onChunk({
        type: 'message_delta',
        usage: { output_tokens: 25 },
      });

      const result = accumulator.finalize();
      expect(result.usage?.promptTokens).toBe(15);
      expect(result.usage?.completionTokens).toBe(25);
      expect(result.usage?.totalTokens).toBe(40);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract finish reason', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({
        choices: [{ delta: { content: 'Done' }, finish_reason: 'stop' }],
      });

      const result = accumulator.finalize();
      expect(result.finishReason).toBe('stop');
    });

    it('should extract model name', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({
        choices: [{ delta: { content: 'Hi' } }],
        model: 'gpt-4-turbo',
      });

      const result = accumulator.finalize();
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should handle Anthropic message_stop', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({ type: 'message_stop' });

      const result = accumulator.finalize();
      expect(result.finishReason).toBe('stop');
    });
  });

  describe('Finalization', () => {
    it('should compute metrics on finalize', async () => {
      const startTime = Date.now();
      const accumulator = new StreamingAccumulator(startTime);

      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'Hello' } }] });
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: ' World' } }] });

      const result = accumulator.finalize();

      expect(result.content).toBe('Hello World');
      expect(result.chunkCount).toBe(2);
      expect(result.ttftMs).toBeGreaterThan(40);
      expect(result.totalDurationMs).toBeGreaterThan(90);
      expect(result.interTokenLatencies).toHaveLength(1);
    });

    it('should warn on multiple finalize calls', () => {
      const accumulator = new StreamingAccumulator(Date.now());
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      accumulator.finalize();
      accumulator.finalize(); // Second call

      expect(consoleSpy).toHaveBeenCalledWith('finalize() called multiple times');
      consoleSpy.mockRestore();
    });

    it('should handle empty stream', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      const result = accumulator.finalize();

      expect(result.content).toBe('');
      expect(result.chunkCount).toBe(0);
      expect(result.ttftMs).toBeUndefined();
      expect(result.interTokenLatencies).toHaveLength(0);
    });
  });

  describe('Attribute Conversion', () => {
    it('should convert to OTEL attributes', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      accumulator.onChunk({
        choices: [{ delta: { content: 'Test' }, finish_reason: 'stop' }],
        model: 'gpt-4',
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      });

      const result = accumulator.finalize();
      const attrs = result.toAttributes();

      expect(attrs['gen_ai.response.model']).toBe('gpt-4');
      expect(attrs['gen_ai.response.finish_reasons']).toEqual(['stop']);
      expect(attrs['gen_ai.usage.input_tokens']).toBe(5);
      expect(attrs['gen_ai.usage.output_tokens']).toBe(10);
      expect(attrs['brokle.usage.total_tokens']).toBe(15);
      expect(attrs['gen_ai.output.messages']).toContain('assistant');
      expect(attrs['gen_ai.output.messages']).toContain('Test');
    });

    it('should include TTFT and ITL in attributes', async () => {
      const accumulator = new StreamingAccumulator(Date.now());

      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'A' } }] });
      await new Promise(resolve => setTimeout(resolve, 50));
      accumulator.onChunk({ choices: [{ delta: { content: 'B' } }] });

      const result = accumulator.finalize();
      const attrs = result.toAttributes();

      expect(attrs['gen_ai.response.time_to_first_token']).toBeGreaterThan(40);
      expect(attrs['gen_ai.response.inter_token_latency']).toBeGreaterThan(40);
      expect(attrs['gen_ai.response.duration']).toBeGreaterThan(90);
    });

    it('should omit undefined attributes', () => {
      const accumulator = new StreamingAccumulator(Date.now());

      // No content, no usage, no metadata
      const result = accumulator.finalize();
      const attrs = result.toAttributes();

      expect(attrs['gen_ai.response.time_to_first_token']).toBeUndefined();
      expect(attrs['gen_ai.response.model']).toBeUndefined();
      expect(attrs['gen_ai.usage.input_tokens']).toBeUndefined();
      expect(attrs['gen_ai.output.messages']).toBeUndefined();
    });
  });

  describe('Custom Extractors', () => {
    it('should use custom content extractor', () => {
      const customExtractor = (chunk: any) => chunk.custom_field || undefined;
      const accumulator = new StreamingAccumulator(Date.now(), {
        contentExtractor: customExtractor,
      });

      accumulator.onChunk({ custom_field: 'Custom content' });

      expect(accumulator.content).toBe('Custom content');
    });

    it('should use custom usage extractor', () => {
      const customExtractor = (chunk: any) => {
        if (chunk.my_usage) {
          return {
            promptTokens: chunk.my_usage.in,
            completionTokens: chunk.my_usage.out,
            totalTokens: chunk.my_usage.total,
          };
        }
        return undefined;
      };

      const accumulator = new StreamingAccumulator(Date.now(), {
        usageExtractor: customExtractor,
      });

      accumulator.onChunk({ my_usage: { in: 100, out: 200, total: 300 } });

      const result = accumulator.finalize();
      expect(result.usage?.promptTokens).toBe(100);
      expect(result.usage?.completionTokens).toBe(200);
      expect(result.usage?.totalTokens).toBe(300);
    });
  });
});
