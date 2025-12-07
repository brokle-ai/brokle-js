/**
 * Anthropic SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept Anthropic API calls and automatically
 * create OTEL spans with GenAI semantic conventions.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getClient, Attrs, LLMProvider, StreamingAccumulator } from 'brokle';
import { SpanStatusCode } from '@opentelemetry/api';
import { extractMessageAttributes } from './parser';

/**
 * Wraps Anthropic SDK client with automatic tracing
 *
 * @param client - Anthropic client instance
 * @returns Proxied Anthropic client with tracing
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { wrapAnthropic } from 'brokle-anthropic';
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
  const brokleClient = getClient();

  return createProxy(client, brokleClient, []);
}

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
async function handleStreamingResponse(
  brokleClient: any,
  originalFn: Function,
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
async function* wrapAsyncIterable(
  stream: AsyncIterable<any>,
  span: any,
  accumulator: StreamingAccumulator
): AsyncIterableIterator<any> {
  let errorOccurred = false;
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

    if (errorOccurred) {
      throw caughtError;
    }
  }
}

/**
 * Wraps messages.create API call with tracing
 */
function tracedMessagesCreate(originalFn: Function, brokleClient: any) {
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `chat ${model}`;

    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: LLMProvider.ANTHROPIC,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };

    if (params.max_tokens !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_MAX_TOKENS] = params.max_tokens;
    }
    if (params.temperature !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TEMPERATURE] = params.temperature;
    }
    if (params.top_p !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TOP_P] = params.top_p;
    }
    if (params.top_k !== undefined) {
      attributes[Attrs.ANTHROPIC_REQUEST_TOP_K] = params.top_k;
    }

    if (params.messages) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(params.messages);
    }

    if (params.system) {
      const systemInstructions = [{ role: 'system', content: params.system }];
      attributes[Attrs.GEN_AI_SYSTEM_INSTRUCTIONS] = JSON.stringify(systemInstructions);
    }

    const isStreaming = params.stream === true;
    if (isStreaming) {
      attributes[Attrs.BROKLE_STREAMING] = true;
    }

    if (isStreaming) {
      return handleStreamingResponse(
        brokleClient,
        originalFn,
        this,
        args,
        spanName,
        attributes
      );
    }

    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      try{
        const response = await originalFn.apply(this, args);
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
      } catch (error) {
        throw error;
      }
    });
  };
}