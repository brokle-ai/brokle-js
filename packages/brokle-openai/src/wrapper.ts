/**
 * OpenAI SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept OpenAI API calls and automatically
 * create OTEL spans with GenAI semantic conventions.
 */

import type OpenAI from 'openai';
import { getClient, Attrs, LLMProvider, StreamingAccumulator } from 'brokle';
import { SpanStatusCode } from '@opentelemetry/api';
import { extractChatCompletionAttributes, extractCompletionAttributes } from './parser';

/**
 * Wraps OpenAI SDK client with automatic tracing
 *
 * Uses recursive Proxy pattern to intercept API calls without modifying
 * the original OpenAI client. All methods work as normal, but with automatic
 * span creation and attribute extraction.
 *
 * @param client - OpenAI client instance
 * @returns Proxied OpenAI client with tracing
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { wrapOpenAI } from 'brokle-openai';
 *
 * const openai = wrapOpenAI(new OpenAI({ apiKey: '...' }));
 *
 * // All calls automatically traced
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function wrapOpenAI<T extends OpenAI>(client: T): T {
  const brokleClient = getClient();

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

        if (pathStr === 'chat.completions.create') {
          return tracedChatCompletion(value.bind(obj), brokleClient);
        }

        if (pathStr === 'completions.create') {
          return tracedCompletion(value.bind(obj), brokleClient);
        }

        if (pathStr === 'embeddings.create') {
          return tracedEmbedding(value.bind(obj), brokleClient);
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
 * Wraps chat completion API call with tracing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChatCompletion(originalFn: (...args: any[]) => Promise<any>, brokleClient: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `chat ${model}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: LLMProvider.OPENAI,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };

    if (params.temperature !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TEMPERATURE] = params.temperature;
    }
    if (params.max_tokens !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_MAX_TOKENS] = params.max_tokens;
    }
    if (params.top_p !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TOP_P] = params.top_p;
    }
    if (params.frequency_penalty !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_FREQUENCY_PENALTY] = params.frequency_penalty;
    }
    if (params.presence_penalty !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_PRESENCE_PENALTY] = params.presence_penalty;
    }
    if (params.user !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_USER] = params.user;
    }

    if (params.n !== undefined) {
      attributes[Attrs.OPENAI_REQUEST_N] = params.n;
    }

    if (params.messages) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(params.messages);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const response = await originalFn.apply(this, args);
      const attrs = extractChatCompletionAttributes(response);

      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.responseModel) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
      }
      if (attrs.finishReasons && attrs.finishReasons.length > 0) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify(attrs.finishReasons));
      }
      if (attrs.systemFingerprint) {
        span.setAttribute(Attrs.OPENAI_RESPONSE_SYSTEM_FINGERPRINT, attrs.systemFingerprint);
      }

      if (attrs.outputMessages) {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(attrs.outputMessages));
      }

      if (attrs.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.promptTokens);
        span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.completionTokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Wraps text completion API call with tracing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedCompletion(originalFn: (...args: any[]) => Promise<any>, brokleClient: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `completion ${model}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'text_completion');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      // Set request parameters
      if (params.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, params.temperature);
      }
      if (params.max_tokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, params.max_tokens);
      }

      // Set prompt
      if (params.prompt) {
        const promptStr = Array.isArray(params.prompt)
          ? JSON.stringify(params.prompt)
          : params.prompt;
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, promptStr);
      }

      const response = await originalFn.apply(this, args);
      const attrs = extractCompletionAttributes(response);

      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.responseModel) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
      }
      if (attrs.completionText) {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, attrs.completionText);
      }
      if (attrs.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.promptTokens);
        span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.completionTokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Wraps embeddings API call with tracing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedEmbedding(originalFn: (...args: any[]) => Promise<any>, brokleClient: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `embedding ${model}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'embedding');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'embeddings');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      // Set input
      if (params.input) {
        const inputStr = Array.isArray(params.input)
          ? JSON.stringify(params.input)
          : params.input;
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, inputStr);
      }

      const response = await originalFn.apply(this, args);

      if (response.model) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, response.model);
      }
      if (response.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, response.usage.prompt_tokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, response.usage.total_tokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}