/**
 * Cohere SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept Cohere API calls
 * and automatically create OTEL spans with GenAI semantic conventions.
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
import type { CohereWrapperOptions, CohereChatAttributes } from './types';

export type { BrokleOptions };

const COHERE_PROVIDER = 'cohere';

// Cohere-specific attribute keys
const COHERE_ATTRS = {
  GENERATION_ID: 'cohere.response.generation_id',
  BILLED_INPUT_TOKENS: 'cohere.usage.billed_input_tokens',
  BILLED_OUTPUT_TOKENS: 'cohere.usage.billed_output_tokens',
  SEARCH_UNITS: 'cohere.usage.search_units',
  CONNECTORS: 'cohere.request.connectors',
  PREAMBLE: 'cohere.request.preamble',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CohereClient = any;

/**
 * Wraps Cohere client with automatic tracing
 *
 * @param client - CohereClientV2 instance
 * @param options - Optional wrapper configuration
 * @returns Proxied CohereClientV2 with tracing
 *
 * @example
 * ```typescript
 * import { CohereClientV2 } from 'cohere-ai';
 * import { wrapCohere } from 'brokle/cohere';
 *
 * const cohere = wrapCohere(new CohereClientV2({ token: '...' }));
 *
 * const response = await cohere.chat({
 *   model: 'command-r-plus',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function wrapCohere<T extends CohereClient>(
  client: T,
  options?: CohereWrapperOptions
): T {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapCohere requires a CohereClientV2 instance. ' +
        'Usage: wrapCohere(new CohereClientV2({ token: "..." }))'
    );
  }

  // Validate Cohere client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  if (typeof c.chat !== 'function' && typeof c.embed !== 'function') {
    throw new Error(
      'Invalid Cohere client passed to wrapCohere. ' +
        'The "cohere-ai" package is required. ' +
        'Install with: npm install cohere-ai'
    );
  }

  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return client;
  }

  return new Proxy(client, {
    get(target, prop: string | symbol) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = target as any;
      if (typeof prop === 'symbol') {
        return t[prop];
      }

      const value = t[prop];

      if (typeof value === 'function') {
        if (prop === 'chat') {
          return tracedChat(value.bind(target), brokleClient, options);
        }

        if (prop === 'chatStream') {
          return tracedChatStream(value.bind(target), brokleClient, options);
        }

        if (prop === 'embed') {
          return tracedEmbed(value.bind(target), brokleClient, options);
        }

        if (prop === 'rerank') {
          return tracedRerank(value.bind(target), brokleClient, options);
        }

        return value.bind(target);
      }

      return value;
    },
  });
}

/**
 * Traced chat method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChat(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: CohereWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'command-r-plus';
    const spanName = `chat ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, COHERE_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);

      // Capture request parameters
      if (cleanParams.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, cleanParams.temperature);
      }
      if (cleanParams.max_tokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, cleanParams.max_tokens);
      }
      if (cleanParams.messages) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(cleanParams.messages));
      }
      if (cleanParams.preamble) {
        span.setAttribute(COHERE_ATTRS.PREAMBLE, cleanParams.preamble);
      }
      if (cleanParams.connectors) {
        span.setAttribute(COHERE_ATTRS.CONNECTORS, JSON.stringify(cleanParams.connectors));
      }

      const response = await originalFn(...cleanArgs);
      const attrs = extractChatAttributes(response);

      if (attrs.generationId) {
        span.setAttribute(COHERE_ATTRS.GENERATION_ID, attrs.generationId);
      }
      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.finishReason) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify([attrs.finishReason]));
      }
      if (attrs.outputMessages) {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(attrs.outputMessages));
      }
      if (attrs.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
        span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
      }
      if (attrs.billedUnits) {
        if (attrs.billedUnits.inputTokens !== undefined) {
          span.setAttribute(COHERE_ATTRS.BILLED_INPUT_TOKENS, attrs.billedUnits.inputTokens);
        }
        if (attrs.billedUnits.outputTokens !== undefined) {
          span.setAttribute(COHERE_ATTRS.BILLED_OUTPUT_TOKENS, attrs.billedUnits.outputTokens);
        }
        if (attrs.billedUnits.searchUnits !== undefined) {
          span.setAttribute(COHERE_ATTRS.SEARCH_UNITS, attrs.billedUnits.searchUnits);
        }
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Traced chatStream method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChatStream(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: CohereWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'command-r-plus';
    const spanName = `chat ${model}`;

    const tracer = brokleClient.getTracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: COHERE_PROVIDER,
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
      const cleanArgs = [cleanParams, ...args.slice(1)];
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
 * Traced embed method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedEmbed(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: CohereWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'embed-english-v3.0';
    const spanName = `embedding ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'embedding');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, COHERE_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'embeddings');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);

      if (cleanParams.texts) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(cleanParams.texts));
      }
      if (cleanParams.input_type) {
        span.setAttribute('cohere.request.input_type', cleanParams.input_type);
      }
      if (cleanParams.embedding_types) {
        span.setAttribute('cohere.request.embedding_types', JSON.stringify(cleanParams.embedding_types));
      }

      const response = await originalFn(...cleanArgs);

      if (response.meta?.billed_units) {
        span.setAttribute(COHERE_ATTRS.BILLED_INPUT_TOKENS, response.meta.billed_units.input_tokens || 0);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Traced rerank method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedRerank(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: CohereWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'rerank-english-v3.0';
    const spanName = `rerank ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'rerank');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, COHERE_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'rerank');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);

      if (cleanParams.query) {
        span.setAttribute('cohere.request.query', cleanParams.query);
      }
      if (cleanParams.documents) {
        span.setAttribute('cohere.request.document_count', cleanParams.documents.length);
      }
      if (cleanParams.top_n !== undefined) {
        span.setAttribute('cohere.request.top_n', cleanParams.top_n);
      }

      const response = await originalFn(...cleanArgs);

      if (response.meta?.billed_units?.search_units !== undefined) {
        span.setAttribute(COHERE_ATTRS.SEARCH_UNITS, response.meta.billed_units.search_units);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Extract chat response attributes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractChatAttributes(response: any): CohereChatAttributes {
  const attrs: CohereChatAttributes = {};

  try {
    attrs.responseId = response.id;
    attrs.generationId = response.generation_id;
    attrs.finishReason = response.finish_reason;

    if (response.message) {
      attrs.outputMessages = [{
        role: response.message.role || 'assistant',
        content: response.message.content?.[0]?.text || null,
      }];
    } else if (response.text) {
      // Legacy format
      attrs.outputMessages = [{
        role: 'assistant',
        content: response.text,
      }];
    }

    if (response.usage) {
      attrs.usage = {
        inputTokens: response.usage.tokens?.input_tokens || response.usage.input_tokens || 0,
        outputTokens: response.usage.tokens?.output_tokens || response.usage.output_tokens || 0,
        totalTokens: 0,
      };
      attrs.usage.totalTokens = attrs.usage.inputTokens + attrs.usage.outputTokens;
    }

    if (response.meta?.billed_units || response.usage?.billed_units) {
      const billedUnits = response.meta?.billed_units || response.usage?.billed_units;
      attrs.billedUnits = {
        inputTokens: billedUnits.input_tokens,
        outputTokens: billedUnits.output_tokens,
        searchUnits: billedUnits.search_units,
      };
    }

    if (response.citations) {
      attrs.citations = response.citations;
    }

    if (response.search_results) {
      attrs.searchResults = response.search_results;
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
