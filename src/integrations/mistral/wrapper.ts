/**
 * Mistral AI SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept Mistral AI API calls and
 * automatically create OTEL spans with GenAI semantic conventions.
 */

import {
  getClient,
  Attrs,
  StreamingAccumulator,
  extractBrokleOptions,
  addPromptAttributes,
  type BrokleOptions,
} from '../../index';
import { SpanStatusCode } from '@opentelemetry/api';
import type { MistralWrapperOptions, MistralChatAttributes, MistralEmbeddingAttributes } from './types';

export type { BrokleOptions };

const MISTRAL_PROVIDER = 'mistral';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MistralClient = any;

/**
 * Wraps Mistral AI client with automatic tracing
 *
 * @param client - Mistral client instance
 * @param options - Optional wrapper configuration
 * @returns Proxied Mistral client with tracing
 *
 * @example
 * ```typescript
 * import Mistral from '@mistralai/mistralai';
 * import { wrapMistral } from 'brokle/mistral';
 *
 * const mistral = wrapMistral(new Mistral({ apiKey: '...' }));
 *
 * const response = await mistral.chat.complete({
 *   model: 'mistral-large-latest',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function wrapMistral<T extends MistralClient>(
  client: T,
  options?: MistralWrapperOptions
): T {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapMistral requires a Mistral client instance. ' +
        'Usage: wrapMistral(new Mistral({ apiKey: "..." }))'
    );
  }

  // Validate Mistral client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  if (!c.chat?.complete && !c.chat?.stream) {
    throw new Error(
      'Invalid Mistral client passed to wrapMistral. ' +
        'The "@mistralai/mistralai" package is required. ' +
        'Install with: npm install @mistralai/mistralai'
    );
  }

  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return client;
  }

  return createProxy(client, brokleClient, [], options);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProxy(target: any, brokleClient: any, path: string[], options?: MistralWrapperOptions): any {
  return new Proxy(target, {
    get(obj, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return obj[prop];
      }

      const value = obj[prop];
      const currentPath = [...path, prop];

      if (typeof value === 'function') {
        const pathStr = currentPath.join('.');

        if (pathStr === 'chat.complete') {
          return tracedChatComplete(value.bind(obj), brokleClient, options);
        }

        if (pathStr === 'chat.stream') {
          return tracedChatStream(value.bind(obj), brokleClient, options);
        }

        if (pathStr === 'embeddings.create') {
          return tracedEmbeddings(value.bind(obj), brokleClient, options);
        }

        return value.bind(obj);
      }

      if (value !== null && typeof value === 'object') {
        return createProxy(value, brokleClient, currentPath, options);
      }

      return value;
    },
  });
}

/**
 * Traced chat.complete
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChatComplete(originalFn: (...args: any[]) => Promise<any>, brokleClient: any, _options?: MistralWrapperOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `chat ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, MISTRAL_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);

      // Capture request parameters
      if (cleanParams.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, cleanParams.temperature);
      }
      if (cleanParams.maxTokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, cleanParams.maxTokens);
      }
      if (cleanParams.topP !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, cleanParams.topP);
      }
      if (cleanParams.messages) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(cleanParams.messages));
      }

      const response = await originalFn(...cleanArgs);
      const attrs = extractChatAttributes(response);

      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.responseModel) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
      }
      if (attrs.finishReason) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify([attrs.finishReason]));
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
 * Traced chat.stream
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChatStream(originalFn: (...args: any[]) => Promise<any>, brokleClient: any, _options?: MistralWrapperOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `chat ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    const tracer = brokleClient.getTracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: MISTRAL_PROVIDER,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
      [Attrs.BROKLE_STREAMING]: true,
    };

    addPromptAttributes(attributes, brokleOpts);

    if (cleanParams.messages) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(cleanParams.messages);
    }

    const span = tracer.startSpan(spanName, { attributes });

    try {
      const startTime = Date.now();
      const stream = await originalFn(...cleanArgs);
      const accumulator = new StreamingAccumulator(startTime);

      return wrapAsyncIterable(stream, span, accumulator);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  };
}

/**
 * Traced embeddings.create
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedEmbeddings(originalFn: (...args: any[]) => Promise<any>, brokleClient: any, _options?: MistralWrapperOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `embedding ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'embedding');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, MISTRAL_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'embeddings');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);

      if (cleanParams.inputs) {
        const inputStr = Array.isArray(cleanParams.inputs)
          ? JSON.stringify(cleanParams.inputs)
          : cleanParams.inputs;
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, inputStr);
      }

      const response = await originalFn(...cleanArgs);
      const attrs = extractEmbeddingAttributes(response);

      if (attrs.model) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.model);
      }
      if (attrs.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.promptTokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Extract chat completion attributes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractChatAttributes(response: any): MistralChatAttributes {
  const attrs: MistralChatAttributes = {};

  try {
    attrs.responseId = response.id;
    attrs.responseModel = response.model;

    const choice = response.choices?.[0];
    if (choice) {
      attrs.finishReason = choice.finishReason || choice.finish_reason;
      if (choice.message) {
        attrs.outputMessages = [{
          role: choice.message.role,
          content: choice.message.content,
          toolCalls: choice.message.toolCalls || choice.message.tool_calls,
        }];
      }
    }

    if (response.usage) {
      attrs.usage = {
        promptTokens: response.usage.promptTokens || response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completionTokens || response.usage.completion_tokens || 0,
        totalTokens: response.usage.totalTokens || response.usage.total_tokens || 0,
      };
    }
  } catch {
    // Ignore extraction errors
  }

  return attrs;
}

/**
 * Extract embedding attributes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEmbeddingAttributes(response: any): MistralEmbeddingAttributes {
  const attrs: MistralEmbeddingAttributes = {};

  try {
    attrs.model = response.model;

    if (response.usage) {
      attrs.usage = {
        promptTokens: response.usage.promptTokens || response.usage.prompt_tokens || 0,
        totalTokens: response.usage.totalTokens || response.usage.total_tokens || 0,
      };
    }
  } catch {
    // Ignore extraction errors
  }

  return attrs;
}

/**
 * Wrap async iterable stream
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
