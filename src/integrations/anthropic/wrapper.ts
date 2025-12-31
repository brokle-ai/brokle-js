/**
 * Anthropic SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept Anthropic API calls and automatically
 * create OTEL spans with GenAI semantic conventions.
 */

import type Anthropic from '@anthropic-ai/sdk';
import {
  getClient,
  Attrs,
  LLMProvider,
  StreamingAccumulator,
  extractBrokleOptions,
  addPromptAttributes,
  type BrokleOptions,
} from '../../index';
import { SpanStatusCode } from '@opentelemetry/api';
import { extractMessageAttributes } from './parser';

export type { BrokleOptions };

/**
 * Wraps Anthropic SDK client with automatic tracing
 *
 * @param client - Anthropic client instance
 * @returns Proxied Anthropic client with tracing
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrapAnthropic } from 'brokle/anthropic';
 *
 * const anthropic = wrapAnthropic(new Anthropic({ apiKey: '...' }));
 *
 * // All calls automatically traced
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-opus-20240229',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function wrapAnthropic<T extends Anthropic>(client: T): T {
  // Runtime validation: check if this looks like an Anthropic client
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapAnthropic requires an Anthropic client instance. ' +
      'Usage: wrapAnthropic(new Anthropic({ apiKey: "..." }))'
    );
  }

  // Validate Anthropic client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  if (!c.messages?.create) {
    throw new Error(
      'Invalid Anthropic client passed to wrapAnthropic. ' +
      'The "@anthropic-ai/sdk" package (^0.30.0) is required. ' +
      'Install it with: npm install @anthropic-ai/sdk'
    );
  }

  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return client;
  }

  return createProxy(client, brokleClient, []);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProxy(target: any, brokleClient: any, path: string[]): any {
  return new Proxy(target, {
    get(obj, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return obj[prop];
      }

      const value = obj[prop];
      const currentPath = [...path, prop];

      if (typeof value === 'function') {
        const pathStr = currentPath.join('.');

        if (pathStr === 'messages.create') {
          return tracedMessagesCreate(value.bind(obj), brokleClient);
        }

        return value.bind(obj);
      }

      if (value !== null && typeof value === 'object') {
        return createProxy(value, brokleClient, currentPath);
      }

      return value;
    },
  });
}

/**
 * Handle streaming response with transparent wrapper instrumentation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStreamingResponse(
  brokleClient: any,
  originalFn: (...args: any[]) => Promise<AsyncIterable<any>>,
  context: any,
  args: any[],
  spanName: string,
  attributes: Record<string, any>
): Promise<AsyncIterable<any>> {
  const tracer = brokleClient.getTracer();
  const span = tracer.startSpan(spanName, { attributes });

  try {
    const startTime = Date.now();
    const stream = await originalFn.apply(context, args);
    const accumulator = new StreamingAccumulator(startTime);

    return wrapAsyncIterable(stream, span, accumulator);
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    span.recordException(error as Error);
    span.end();
    throw error;
  }
}

/**
 * Wrap async iterable stream with accumulator instrumentation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function* wrapAsyncIterable(
  stream: AsyncIterable<any>,
  span: any,
  accumulator: StreamingAccumulator
): AsyncIterableIterator<any> {
  let errorOccurred = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let caughtError: any;

  try {
    for await (const chunk of stream) {
      accumulator.onChunk(chunk);
      yield chunk;
    }
  } catch (error) {
    errorOccurred = true;
    caughtError = error;

    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    span.recordException(error as Error);
  } finally {
    const result = accumulator.finalize();
    const attrs = result.toAttributes();

    for (const [key, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) {
        span.setAttribute(key, value);
      }
    }

    if (!errorOccurred) {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  }

  if (errorOccurred) {
    throw caughtError;
  }
}

/**
 * Wraps messages.create API call with tracing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedMessagesCreate(originalFn: (...args: any[]) => Promise<any>, brokleClient: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (this: any, ...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `chat ${model}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: LLMProvider.ANTHROPIC,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };

    addPromptAttributes(attributes, brokleOpts);

    if (cleanParams.max_tokens !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_MAX_TOKENS] = cleanParams.max_tokens;
    }
    if (cleanParams.temperature !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TEMPERATURE] = cleanParams.temperature;
    }
    if (cleanParams.top_p !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TOP_P] = cleanParams.top_p;
    }
    if (cleanParams.top_k !== undefined) {
      attributes[Attrs.ANTHROPIC_REQUEST_TOP_K] = cleanParams.top_k;
    }

    if (cleanParams.messages) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(cleanParams.messages);
    }

    if (cleanParams.system) {
      const systemInstructions = [{ role: 'system', content: cleanParams.system }];
      attributes[Attrs.GEN_AI_SYSTEM_INSTRUCTIONS] = JSON.stringify(systemInstructions);
    }

    const isStreaming = cleanParams.stream === true;
    if (isStreaming) {
      attributes[Attrs.BROKLE_STREAMING] = true;
    }

    const cleanArgs = [cleanParams, ...args.slice(1)];

    if (isStreaming) {
      return handleStreamingResponse(
        brokleClient,
        originalFn,
        this,
        cleanArgs,
        spanName,
        attributes
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const response = await originalFn.apply(this, cleanArgs);
      const attrs = extractMessageAttributes(response);

      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.responseModel) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
      }
      if (attrs.stopReason) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify([attrs.stopReason]));
      }

      if (attrs.outputContent) {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([{
          role: 'assistant',
          content: attrs.outputContent,
        }]));
      }

      if (attrs.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
        span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.inputTokens + attrs.usage.outputTokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}
