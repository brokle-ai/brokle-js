/**
 * Brokle Span Processor (Wrapper Pattern)
 *
 * Wraps either BatchSpanProcessor or SimpleSpanProcessor based on configuration.
 * This pattern allows for future extensibility (e.g., PII masking, attribute transformation).
 */

import type {
  SpanProcessor,
  ReadableSpan,
  Span,
} from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { BrokleConfig } from './types/config';

/**
 * Brokle-specific span processor that wraps OTEL processors
 *
 * Features:
 * - Automatic processor selection (Batch vs Simple)
 * - Future: PII masking support
 * - Future: Custom attribute transformation
 * - Async onEnd() for complex processing
 *
 * Pattern: Wrapper (NOT inheritance)
 * - Implements SpanProcessor interface
 * - Delegates to wrapped BatchSpanProcessor or SimpleSpanProcessor
 * - More flexible than extending
 */
export class BrokleSpanProcessor implements SpanProcessor {
  private processor: SpanProcessor;
  private environment: string;
  private release: string;

  /**
   * Creates a new BrokleSpanProcessor
   *
   * @param exporter - OTLP span exporter
   * @param config - Brokle configuration
   */
  constructor(exporter: SpanExporter, config: BrokleConfig) {
    this.environment = config.environment;
    this.release = config.release;

    if (config.flushSync) {
      // SimpleSpanProcessor for serverless/lambda environments
      // Exports immediately, no batching
      this.processor = new SimpleSpanProcessor(exporter);

      if (config.debug) {
        console.log('[Brokle] Using SimpleSpanProcessor (flushSync=true)');
      }
    } else {
      // BatchSpanProcessor for long-running applications
      // Batches spans for efficiency
      this.processor = new BatchSpanProcessor(exporter, {
        maxQueueSize: config.maxQueueSize,
        scheduledDelayMillis: config.flushInterval * 1000,
        maxExportBatchSize: config.flushAt,
        exportTimeoutMillis: config.timeout,
      });

      if (config.debug) {
        console.log('[Brokle] Using BatchSpanProcessor:', {
          maxQueueSize: config.maxQueueSize,
          flushInterval: config.flushInterval,
          batchSize: config.flushAt,
        });
      }
    }
  }

  /**
   * Called when a span is started
   * Sets environment and release as span attributes
   */
  onStart(span: Span, parentContext: Context): void {
    // Add environment as span attribute (not resource attribute)
    if (this.environment) {
      span.setAttribute('brokle.environment', this.environment);
    }

    // Add release as span attribute (for experiment tracking)
    if (this.release) {
      span.setAttribute('brokle.release', this.release);
    }

    this.processor.onStart(span, parentContext);
  }

  /**
   * Called when a span is ended
   * Post-processing hook (async support for future features)
   *
   * IMPORTANT: Sampling is handled by TracerProvider's TraceIdRatioBasedSampler.
   * We do NOT sample here to avoid creating partial traces.
   */
  async onEnd(span: ReadableSpan): Promise<void> {
    // Future: Apply PII masking
    // if (this.config.mask) {
    //   span = this.applyMasking(span);
    // }

    // Future: Custom attribute transformation
    // span = this.transformAttributes(span);

    // Delegate to wrapped processor
    await this.processor.onEnd(span);
  }

  /**
   * Force flush all pending spans
   */
  async forceFlush(): Promise<void> {
    await this.processor.forceFlush();
  }

  /**
   * Shutdown the processor and exporter
   */
  async shutdown(): Promise<void> {
    await this.processor.shutdown();
  }
}