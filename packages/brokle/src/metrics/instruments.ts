/**
 * GenAI Metrics Instruments
 *
 * Provides histogram and counter instruments for AI/LLM observability.
 * Matches Python SDK's GenAIMetrics class for cross-platform consistency.
 */

import type { Meter, Counter, Histogram, Attributes } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';
import {
  MetricNames,
  TOKEN_BOUNDARIES,
  DURATION_BOUNDARIES,
  TTFT_BOUNDARIES,
  INTER_TOKEN_BOUNDARIES,
} from './constants';

/**
 * Common attributes for all metrics
 */
export interface MetricAttributes {
  /** Model name (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;
  /** Provider name (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Operation type (e.g., 'chat', 'completion', 'embeddings') */
  operation?: string;
  /** Additional custom attributes */
  [key: string]: string | number | boolean | undefined;
}

/**
 * GenAI metrics collection class.
 *
 * Provides pre-configured histograms and counters for common LLM metrics:
 * - Token usage (input, output, total)
 * - Operation duration
 * - Time-to-first-token (TTFT)
 * - Inter-token latency
 * - Request/error counts
 */
export class GenAIMetrics {
  private meter: Meter;

  // Histograms
  private tokenUsageHistogram: Histogram;
  private durationHistogram: Histogram;
  private ttftHistogram: Histogram;
  private interTokenLatencyHistogram: Histogram;

  // Counters
  private requestCounter: Counter;
  private errorCounter: Counter;
  private inputTokensCounter: Counter;
  private outputTokensCounter: Counter;

  /**
   * Creates a new GenAIMetrics instance.
   *
   * @param meterName - Name for the meter (default: 'brokle')
   * @param meterVersion - Version for the meter (default: '0.1.0')
   */
  constructor(meterName = 'brokle', meterVersion = '0.1.0') {
    this.meter = metrics.getMeter(meterName, meterVersion);

    // Histograms
    this.tokenUsageHistogram = this.meter.createHistogram(MetricNames.TOKEN_USAGE, {
      description: 'Token usage per request',
      unit: 'tokens',
      advice: { explicitBucketBoundaries: [...TOKEN_BOUNDARIES] },
    });

    this.durationHistogram = this.meter.createHistogram(MetricNames.OPERATION_DURATION, {
      description: 'Operation duration',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [...DURATION_BOUNDARIES] },
    });

    this.ttftHistogram = this.meter.createHistogram(MetricNames.TIME_TO_FIRST_TOKEN, {
      description: 'Time to first token for streaming responses',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [...TTFT_BOUNDARIES] },
    });

    this.interTokenLatencyHistogram = this.meter.createHistogram(MetricNames.INTER_TOKEN_LATENCY, {
      description: 'Inter-token latency for streaming responses',
      unit: 'ms',
      advice: { explicitBucketBoundaries: [...INTER_TOKEN_BOUNDARIES] },
    });

    // Counters
    this.requestCounter = this.meter.createCounter(MetricNames.REQUEST_COUNT, {
      description: 'Total number of requests',
      unit: 'requests',
    });

    this.errorCounter = this.meter.createCounter(MetricNames.ERROR_COUNT, {
      description: 'Total number of errors',
      unit: 'errors',
    });

    this.inputTokensCounter = this.meter.createCounter(MetricNames.INPUT_TOKENS, {
      description: 'Total input tokens',
      unit: 'tokens',
    });

    this.outputTokensCounter = this.meter.createCounter(MetricNames.OUTPUT_TOKENS, {
      description: 'Total output tokens',
      unit: 'tokens',
    });
  }

  /**
   * Record token usage metrics.
   *
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param attrs - Metric attributes (model, provider, operation)
   */
  recordTokens(inputTokens: number, outputTokens: number, attrs: MetricAttributes): void {
    const attributes = this.buildAttributes(attrs);
    const totalTokens = inputTokens + outputTokens;

    this.tokenUsageHistogram.record(totalTokens, attributes);
    this.inputTokensCounter.add(inputTokens, attributes);
    this.outputTokensCounter.add(outputTokens, attributes);
  }

  /**
   * Record operation duration.
   *
   * @param durationMs - Duration in milliseconds
   * @param attrs - Metric attributes (model, provider, operation)
   */
  recordDuration(durationMs: number, attrs: MetricAttributes): void {
    const attributes = this.buildAttributes(attrs);
    this.durationHistogram.record(durationMs, attributes);
  }

  /**
   * Record time-to-first-token for streaming responses.
   *
   * @param ttftMs - Time to first token in milliseconds
   * @param attrs - Metric attributes (model, provider)
   */
  recordTimeToFirstToken(ttftMs: number, attrs: MetricAttributes): void {
    const attributes = this.buildAttributes(attrs);
    this.ttftHistogram.record(ttftMs, attributes);
  }

  /**
   * Record inter-token latency for streaming responses.
   *
   * @param latencyMs - Inter-token latency in milliseconds
   * @param attrs - Metric attributes (model, provider)
   */
  recordInterTokenLatency(latencyMs: number, attrs: MetricAttributes): void {
    const attributes = this.buildAttributes(attrs);
    this.interTokenLatencyHistogram.record(latencyMs, attributes);
  }

  /**
   * Increment request counter.
   *
   * @param attrs - Metric attributes (model, provider, operation)
   */
  recordRequest(attrs: MetricAttributes): void {
    const attributes = this.buildAttributes(attrs);
    this.requestCounter.add(1, attributes);
  }

  /**
   * Increment error counter.
   *
   * @param attrs - Metric attributes (model, provider, operation)
   * @param errorType - Optional error type classification
   */
  recordError(attrs: MetricAttributes, errorType?: string): void {
    const attributes = this.buildAttributes(attrs);
    if (errorType) {
      attributes['error.type'] = errorType;
    }
    this.errorCounter.add(1, attributes);
  }

  /**
   * Build OTEL-compatible attributes from MetricAttributes.
   */
  private buildAttributes(attrs: MetricAttributes): Attributes {
    const result: Attributes = {
      'gen_ai.request.model': attrs.model,
      'gen_ai.provider.name': attrs.provider,
    };

    if (attrs.operation) {
      result['gen_ai.operation.name'] = attrs.operation;
    }

    // Add extra attributes (excluding reserved keys)
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== 'model' && key !== 'provider' && key !== 'operation' && value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get the underlying meter for advanced use cases.
   */
  getMeter(): Meter {
    return this.meter;
  }
}

/**
 * Factory function to create GenAIMetrics instance.
 *
 * @param meterName - Name for the meter
 * @param meterVersion - Version for the meter
 * @returns GenAIMetrics instance
 */
export function createGenAIMetrics(meterName?: string, meterVersion?: string): GenAIMetrics {
  return new GenAIMetrics(meterName, meterVersion);
}
