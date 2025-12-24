/**
 * TypeScript decorators for automatic tracing
 *
 * Requires TypeScript 5.0+ with experimentalDecorators enabled
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { getClient } from './client';
import { Attrs } from './types/attributes';
import type { Prompt } from './prompt';

/**
 * Options for the @observe decorator
 */
export interface ObserveOptions {
  /** Custom span name (default: method name) */
  name?: string;
  /** Span type */
  asType?: 'span' | 'generation' | 'event' | 'tool';
  /** User ID for filtering */
  userId?: string;
  /** Session ID for filtering */
  sessionId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Version for A/B testing and experiment tracking */
  version?: string;
  /** Capture function input as span attribute */
  captureInput?: boolean;
  /** Capture function output as span attribute */
  captureOutput?: boolean;
  /** Prompt to link to this span (fallback prompts are not linked) */
  prompt?: Prompt;
}

/**
 * Decorator for automatic tracing of class methods
 *
 * @param options - Configuration options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class AIService {
 *   @observe({ name: 'ask-llm', asType: 'generation' })
 *   async askLLM(prompt: string): Promise<string> {
 *     const response = await openai.chat.completions.create({...});
 *     return response.choices[0].message.content;
 *   }
 *
 *   @observe({ captureInput: true, captureOutput: true })
 *   async processData(data: any): Promise<any> {
 *     // Processing logic
 *     return result;
 *   }
 * }
 * ```
 */
export function observe(options: ObserveOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error(`@observe can only be applied to methods, got ${typeof originalMethod}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (this: any, ...args: any[]) {
      const client = getClient();

      if (!client.getConfig().enabled) {
        return await originalMethod.apply(this, args);
      }

      const tracer = client.getTracer();
      const spanName = options.name || propertyKey;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attrs: Record<string, any> = {
        [Attrs.BROKLE_SPAN_TYPE]: options.asType || 'span',
      };

      if (options.userId) {
        attrs[Attrs.USER_ID] = options.userId;
      }
      if (options.sessionId) {
        attrs[Attrs.SESSION_ID] = options.sessionId;
      }
      if (options.tags && options.tags.length > 0) {
        attrs[Attrs.TAGS] = JSON.stringify(options.tags);
      }
      if (options.metadata && Object.keys(options.metadata).length > 0) {
        attrs[Attrs.METADATA] = JSON.stringify(options.metadata);
      }
      if (options.version) {
        attrs[Attrs.BROKLE_VERSION] = options.version;
      }

      // Link prompt if provided and NOT a fallback
      if (options.prompt && !options.prompt.isFallback) {
        attrs[Attrs.BROKLE_PROMPT_NAME] = options.prompt.name;
        attrs[Attrs.BROKLE_PROMPT_VERSION] = options.prompt.version;
        if (options.prompt.id && options.prompt.id !== 'fallback') {
          attrs[Attrs.BROKLE_PROMPT_ID] = options.prompt.id;
        }
      }

      if (options.captureInput) {
        try {
          attrs['input'] = JSON.stringify(args);
        } catch (error) {
          // Silently ignore serialization errors
          attrs['input'] = '[unable to serialize]';
        }
      }

      return await tracer.startActiveSpan(spanName, { attributes: attrs }, async (span) => {
        try {
          const result = await originalMethod.apply(this, args);

          if (options.captureOutput) {
            try {
              span.setAttribute('output', JSON.stringify(result));
            } catch (error) {
              // Silently ignore serialization errors
              span.setAttribute('output', '[unable to serialize]');
            }
          }

          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          const err = error as Error;

          span.recordException(err);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });

          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Utility function to trace a standalone function (not a class method)
 *
 * @param name - Span name
 * @param fn - Function to trace
 * @param options - Tracing options
 * @returns Traced function
 *
 * @example
 * ```typescript
 * const tracedFn = traceFunction('process-data', async (data) => {
 *   return processData(data);
 * }, { captureInput: true });
 *
 * const result = await tracedFn(myData);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traceFunction<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options: Omit<ObserveOptions, 'name'> = {}
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    const client = getClient();

    if (!client.getConfig().enabled) {
      return await fn(...args);
    }

    const tracer = client.getTracer();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attrs: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: options.asType || 'span',
    };

    if (options.userId) {
      attrs[Attrs.USER_ID] = options.userId;
    }
    if (options.sessionId) {
      attrs[Attrs.SESSION_ID] = options.sessionId;
    }
    if (options.tags && options.tags.length > 0) {
      attrs[Attrs.TAGS] = JSON.stringify(options.tags);
    }
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      attrs[Attrs.METADATA] = JSON.stringify(options.metadata);
    }
    if (options.version) {
      attrs[Attrs.BROKLE_VERSION] = options.version;
    }

    // Link prompt if provided and NOT a fallback
    if (options.prompt && !options.prompt.isFallback) {
      attrs[Attrs.BROKLE_PROMPT_NAME] = options.prompt.name;
      attrs[Attrs.BROKLE_PROMPT_VERSION] = options.prompt.version;
      if (options.prompt.id && options.prompt.id !== 'fallback') {
        attrs[Attrs.BROKLE_PROMPT_ID] = options.prompt.id;
      }
    }

    if (options.captureInput) {
      try {
        attrs['input'] = JSON.stringify(args);
      } catch {
        attrs['input'] = '[unable to serialize]';
      }
    }

    return await tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
      try {
        const result = await fn(...args);

        if (options.captureOutput) {
          try {
            span.setAttribute('output', JSON.stringify(result));
          } catch {
            span.setAttribute('output', '[unable to serialize]');
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const err = error as Error;
        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }) as T;
}