/**
 * Streaming accumulator for LLM responses.
 *
 * Tracks time-to-first-token (TTFT), inter-token latency, and accumulates
 * streamed content for final span attributes.
 *
 * Based on patterns from Langfuse SDK's completion_start_time tracking
 * and OpenLIT's streaming metrics implementation.
 */

import { BrokleOtelSpanAttributes as Attrs } from '../types/attributes';

/**
 * Result of streaming accumulation.
 *
 * Contains all metrics and accumulated content from a streaming response.
 */
export interface StreamingResult {
  /** Accumulated response content */
  content: string;
  /** Time to first token in milliseconds */
  ttftMs?: number;
  /** Total streaming duration in milliseconds */
  totalDurationMs?: number;
  /** Estimated token count (based on chunks received) */
  tokenCount: number;
  /** List of inter-token latencies in ms */
  interTokenLatencies: number[];
  /** Average inter-token latency */
  avgInterTokenLatencyMs?: number;
  /** Number of chunks received */
  chunkCount: number;
  /** LLM finish reason (e.g., "stop", "length") */
  finishReason?: string;
  /** Model name if extracted from stream */
  model?: string;
  /** Token usage info if available from stream */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Convert streaming result to span attributes */
  toAttributes(): Record<string, any>;
}

/**
 * Content extractor function type.
 */
export type ContentExtractor = (chunk: any) => string | undefined;

/**
 * Finish reason extractor function type.
 */
export type FinishReasonExtractor = (chunk: any) => string | undefined;

/**
 * Model extractor function type.
 */
export type ModelExtractor = (chunk: any) => string | undefined;

/**
 * Usage extractor function type.
 */
export type UsageExtractor = (chunk: any) => {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | undefined;

/**
 * Accumulator for streaming LLM responses.
 *
 * Tracks timing metrics and accumulates content from streaming responses.
 * Works with both OpenAI and Anthropic streaming formats.
 *
 * @example
 * ```typescript
 * const accumulator = new StreamingAccumulator(Date.now());
 * for await (const chunk of stream) {
 *   const content = accumulator.onChunk(chunk);
 *   if (content) {
 *     process.stdout.write(content);
 *   }
 * }
 * const result = accumulator.finalize();
 * span.setAttributes(result.toAttributes());
 * ```
 */
export class StreamingAccumulator {
  private readonly startTime: number;
  private firstTokenTime?: number;
  private lastChunkTime?: number;
  private chunks: string[] = [];
  private interTokenLatencies: number[] = [];
  private chunkCount = 0;
  private finishReason?: string;
  private model?: string;
  private usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  private finalized = false;
  private anthropicInputTokens?: number; // Track input tokens from message_start

  // Custom extractors (fallback to auto-detection)
  private readonly contentExtractor?: ContentExtractor;
  private readonly finishReasonExtractor?: FinishReasonExtractor;
  private readonly modelExtractor?: ModelExtractor;
  private readonly usageExtractor?: UsageExtractor;

  /**
   * Initialize streaming accumulator.
   *
   * @param startTime - Time when API call was initiated (from Date.now())
   * @param options - Optional custom extractors
   */
  constructor(
    startTime: number,
    options?: {
      contentExtractor?: ContentExtractor;
      finishReasonExtractor?: FinishReasonExtractor;
      modelExtractor?: ModelExtractor;
      usageExtractor?: UsageExtractor;
    }
  ) {
    this.startTime = startTime;
    this.contentExtractor = options?.contentExtractor;
    this.finishReasonExtractor = options?.finishReasonExtractor;
    this.modelExtractor = options?.modelExtractor;
    this.usageExtractor = options?.usageExtractor;
  }

  onChunk(chunk: any): string | undefined {
    if (this.finalized) {
      console.warn('onChunk called after finalize()');
      return undefined;
    }

    const now = Date.now();
    const content = this.extractContent(chunk);

    if (content && this.firstTokenTime === undefined) {
      this.firstTokenTime = now;
    }

    if (content && this.lastChunkTime !== undefined) {
      const latencyMs = now - this.lastChunkTime;
      this.interTokenLatencies.push(latencyMs);
    }

    if (content) {
      this.lastChunkTime = now;
      this.chunks.push(content);
    }

    this.chunkCount++;

    if (this.finishReason === undefined) {
      this.finishReason = this.extractFinishReason(chunk);
    }
    if (this.model === undefined) {
      this.model = this.extractModel(chunk);
    }

    const extractedUsage = this.extractUsage(chunk);
    if (extractedUsage) {
      if (
        extractedUsage.promptTokens > 0 &&
        this.anthropicInputTokens === undefined
      ) {
        this.anthropicInputTokens = extractedUsage.promptTokens;
      }

      if (
        this.anthropicInputTokens &&
        extractedUsage.promptTokens === 0
      ) {
        extractedUsage.promptTokens = this.anthropicInputTokens;
        extractedUsage.totalTokens =
          this.anthropicInputTokens + extractedUsage.completionTokens;
      }

      this.usage = extractedUsage;
    }

    return content;
  }

  /**
   * Finalize streaming and compute metrics.
   *
   * @returns StreamingResult with accumulated content and metrics
   */
  finalize(): StreamingResult {
    if (this.finalized) {
      console.warn('finalize() called multiple times');
    }

    this.finalized = true;
    const now = Date.now();

    // Compute TTFT
    const ttftMs =
      this.startTime !== undefined && this.firstTokenTime !== undefined
        ? this.firstTokenTime - this.startTime
        : undefined;

    // Compute total duration
    const totalDurationMs =
      this.startTime !== undefined ? now - this.startTime : undefined;

    // Compute average inter-token latency
    const avgItl =
      this.interTokenLatencies.length > 0
        ? this.interTokenLatencies.reduce((a, b) => a + b, 0) /
          this.interTokenLatencies.length
        : undefined;

    // Estimate token count from chunks
    // This is approximate - actual count comes from usage if available
    const tokenCount =
      this.usage?.completionTokens ?? this.chunks.length;

    const content = this.chunks.join('');

    return {
      content,
      ttftMs,
      totalDurationMs,
      tokenCount,
      interTokenLatencies: [...this.interTokenLatencies],
      avgInterTokenLatencyMs: avgItl,
      chunkCount: this.chunkCount,
      finishReason: this.finishReason,
      model: this.model,
      usage: this.usage,
      toAttributes: () => this.toAttributes(content, ttftMs, avgItl, totalDurationMs),
    };
  }

  /**
   * Convert streaming result to span attributes.
   *
   * @returns Dictionary of span attributes following OTEL GenAI conventions
   */
  private toAttributes(
    content: string,
    ttftMs?: number,
    avgItl?: number,
    totalDurationMs?: number
  ): Record<string, any> {
    const attrs: Record<string, any> = {};

    // TTFT (time to first token)
    if (ttftMs !== undefined) {
      attrs[Attrs.GEN_AI_RESPONSE_TIME_TO_FIRST_TOKEN] = ttftMs;
    }

    // Inter-token latency (average)
    if (avgItl !== undefined) {
      attrs[Attrs.GEN_AI_RESPONSE_INTER_TOKEN_LATENCY] = avgItl;
    }

    // Total duration
    if (totalDurationMs !== undefined) {
      attrs[Attrs.GEN_AI_RESPONSE_DURATION] = totalDurationMs;
    }

    // Finish reason
    if (this.finishReason) {
      attrs[Attrs.GEN_AI_RESPONSE_FINISH_REASONS] = [this.finishReason];
    }

    // Model (if extracted from stream)
    if (this.model) {
      attrs[Attrs.GEN_AI_RESPONSE_MODEL] = this.model;
    }

    // Token usage - OTEL GenAI standard attributes
    if (this.usage) {
      if (this.usage.promptTokens) {
        attrs[Attrs.GEN_AI_USAGE_INPUT_TOKENS] = this.usage.promptTokens;
      }
      if (this.usage.completionTokens) {
        attrs[Attrs.GEN_AI_USAGE_OUTPUT_TOKENS] = this.usage.completionTokens;
      }
      if (this.usage.totalTokens) {
        attrs[Attrs.BROKLE_USAGE_TOTAL_TOKENS] = this.usage.totalTokens;
      }
    }

    // Output messages - OTEL standard format (matches non-streaming)
    if (content) {
      const outputMessages = [{ role: 'assistant', content }];
      attrs[Attrs.GEN_AI_OUTPUT_MESSAGES] = JSON.stringify(outputMessages);
    }

    return attrs;
  }

  private extractContent(chunk: any): string | undefined {
    if (this.contentExtractor) {
      return this.contentExtractor(chunk);
    }

    if (chunk.choices) {
      const choices = chunk.choices;
      if (choices && choices.length > 0) {
        const delta = choices[0].delta;
        if (delta && delta.content !== undefined) {
          return delta.content;
        }
      }
    }

    if (chunk.delta && chunk.delta.text !== undefined) {
      return chunk.delta.text;
    }

    if (chunk.type === 'content_block_delta') {
      const delta = chunk.delta;
      if (delta && delta.text !== undefined) {
        return delta.text;
      }
    }

    return undefined;
  }

  private extractFinishReason(chunk: any): string | undefined {
    if (this.finishReasonExtractor) {
      return this.finishReasonExtractor(chunk);
    }

    if (chunk.choices) {
      const choices = chunk.choices;
      if (choices && choices.length > 0) {
        return choices[0].finish_reason ?? undefined;
      }
    }

    if (chunk.type === 'message_stop') {
      return 'stop';
    }

    return undefined;
  }

  private extractModel(chunk: any): string | undefined {
    if (this.modelExtractor) {
      return this.modelExtractor(chunk);
    }

    if (chunk.model !== undefined) {
      return chunk.model;
    }

    return undefined;
  }

  /**
   * Extract token usage from chunk.
   *
   * Handles both OpenAI and Anthropic streaming formats:
   * - OpenAI: usage in final chunk with prompt_tokens/completion_tokens/total_tokens
   * - Anthropic: input_tokens in message_start, output_tokens in message_delta
   *
   * Returns normalized object with promptTokens, completionTokens, totalTokens.
   */
  private extractUsage(chunk: any): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | undefined {
    if (this.usageExtractor) {
      return this.usageExtractor(chunk);
    }

    // Anthropic message_start: usage in event.message.usage
    if (chunk.type === 'message_start') {
      const message = chunk.message;
      if (message && message.usage) {
        const usage = message.usage;
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        return {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        };
      }
    }

    // Anthropic message_delta: usage in event.usage (output_tokens only, cumulative)
    if (chunk.type === 'message_delta') {
      const usage = chunk.usage;
      if (usage && usage.output_tokens !== undefined) {
        const outputTokens = usage.output_tokens ?? 0;
        return {
          promptTokens: 0, // Not available in delta, will be merged later
          completionTokens: outputTokens,
          totalTokens: outputTokens,
        };
      }
    }

    // OpenAI format: usage in chunk.usage with prompt_tokens/completion_tokens
    if (chunk.usage !== undefined && chunk.usage !== null) {
      const usage = chunk.usage;
      // Check for OpenAI field names (prompt_tokens)
      if (usage.prompt_tokens !== undefined) {
        return {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        };
      }
      // Fallback: Anthropic field names at chunk.usage level (edge case)
      if (usage.input_tokens !== undefined) {
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        return {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        };
      }
    }

    return undefined;
  }

  /**
   * Get accumulated content so far.
   */
  get content(): string {
    return this.chunks.join('');
  }

  /**
   * Get time to first token in milliseconds (undefined until first token received).
   */
  get ttftMs(): number | undefined {
    if (this.startTime === undefined || this.firstTokenTime === undefined) {
      return undefined;
    }
    return this.firstTokenTime - this.startTime;
  }

  /**
   * Check if streaming has been finalized.
   */
  get isFinalized(): boolean {
    return this.finalized;
  }
}
