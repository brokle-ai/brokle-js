/**
 * Brokle Span Processor (Wrapper Pattern)
 *
 * Wraps either BatchSpanProcessor or SimpleSpanProcessor based on configuration.
 * Provides client-side PII masking and attribute transformation capabilities.
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
import { Attrs } from './types/attributes';

// Attributes that should be masked if masking is configured
const MASKABLE_ATTRIBUTES = [
  Attrs.INPUT_VALUE,
  Attrs.OUTPUT_VALUE,
  Attrs.GEN_AI_INPUT_MESSAGES,
  Attrs.GEN_AI_OUTPUT_MESSAGES,
  Attrs.METADATA,
] as const;

/**
 * Brokle-specific span processor that wraps OTEL processors
 *
 * Features:
 * - Automatic processor selection (Batch vs Simple)
 * - Client-side PII masking support
 * - Custom attribute transformation
 * - Async onEnd() for complex processing
 *
 * Pattern: Wrapper (NOT inheritance)
 * - Implements SpanProcessor interface
 * - Delegates to wrapped BatchSpanProcessor or SimpleSpanProcessor
 * - More flexible than extending
 */
export class BrokleSpanProcessor implements SpanProcessor {
  private processor: SpanProcessor;
  private config: BrokleConfig;
  private environment: string;
  private release: string;

  /**
   * Creates a new BrokleSpanProcessor
   *
   * @param exporter - OTLP span exporter
   * @param config - Brokle configuration
   */
  constructor(exporter: SpanExporter, config: BrokleConfig) {
    this.config = config;
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
   * Called when a span is started. Sets environment and release attributes.
   */
  onStart(span: Span, parentContext: Context): void {
    if (this.environment) {
      span.setAttribute('brokle.environment', this.environment);
    }

    if (this.release) {
      span.setAttribute('brokle.release', this.release);
    }

    this.processor.onStart(span, parentContext);
  }

  /**
   * Called when span ends. Applies PII masking if configured.
   */
  async onEnd(span: ReadableSpan): Promise<void> {
    if (this.config.mask) {
      this.applyMasking(span);
    }

    await this.processor.onEnd(span);
  }

  async forceFlush(): Promise<void> {
    await this.processor.forceFlush();
  }

  async shutdown(): Promise<void> {
    await this.processor.shutdown();
  }

  /**
   * Apply PII masking to sensitive span attributes.
   *
   * Note: JavaScript OTEL span.attributes is mutable (unlike Python's immutable proxy).
   * TypeScript 'readonly' is compile-time only and doesn't prevent property mutations.
   */
  private applyMasking(span: ReadableSpan): void {
    const attributes = span.attributes;
    if (!attributes) {
      return;
    }

    for (const attrKey of MASKABLE_ATTRIBUTES) {
      if (attrKey in attributes) {
        const originalValue = attributes[attrKey];
        const maskedValue = this.maskAttribute(originalValue);
        (attributes as Record<string, unknown>)[attrKey] = maskedValue;
      }
    }
  }

  /**
   * Apply masking function with error fallback.
   */
  private maskAttribute(data: unknown): unknown {
    try {
      return this.config.mask!(data);
    } catch (error) {
      console.error(
        `[Brokle] Masking failed: ${error instanceof Error ? error.name : 'Unknown'}: ${error instanceof Error ? error.message.substring(0, 100) : ''}`
      );
      return '<fully masked due to failed mask function>';
    }
  }
}