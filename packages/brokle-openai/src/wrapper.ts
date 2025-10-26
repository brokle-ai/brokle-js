/**
 * OpenAI SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept OpenAI API calls and automatically
 * create OTEL spans with GenAI semantic conventions.
 */

import type OpenAI from 'openai';
import { getClient, Attrs, LLMProvider } from 'brokle';
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

/**
 * Creates a recursive proxy for OpenAI client
 *
 * @param target - Object to proxy
 * @param brokleClient - Brokle client for tracing
 * @param path - Current property path (for debugging)
 * @returns Proxied object
 */
function createProxy(target: any, brokleClient: any, path: string[]): any {
  return new Proxy(target, {
    get(obj, prop: string | symbol) {
      // Guard against symbol keys (e.g., Symbol.toStringTag, Symbol.asyncIterator)
      // Pass them through unchanged to avoid crashes from join('.')
      if (typeof prop === 'symbol') {
        return obj[prop];
      }

      const value = obj[prop];
      const currentPath = [...path, prop];

      // If it's a function, check if we should trace it
      if (typeof value === 'function') {
        // Check if this is a traced endpoint
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

        // For other functions, just bind and return
        return value.bind(obj);
      }

      // If it's an object, recursively proxy it
      if (value !== null && typeof value === 'object') {
        return createProxy(value, brokleClient, currentPath);
      }

      // For primitive values, return as-is
      return value;
    },
  });
}

/**
 * Wraps chat completion API call with tracing
 */
function tracedChatCompletion(originalFn: Function, brokleClient: any) {
  return async function (this: any, ...args: any[]) {
    const params = args[0]; // First argument is the request params

    // Extract model name for span name
    const model = params.model || 'unknown';
    const spanName = `chat ${model}`;

    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      // Set initial attributes
      span.setAttribute(Attrs.BROKLE_OBSERVATION_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.OPENAI);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      // Set request parameters
      if (params.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, params.temperature);
      }
      if (params.max_tokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, params.max_tokens);
      }
      if (params.top_p !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, params.top_p);
      }
      if (params.frequency_penalty !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_FREQUENCY_PENALTY, params.frequency_penalty);
      }
      if (params.presence_penalty !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_PRESENCE_PENALTY, params.presence_penalty);
      }
      if (params.user !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_USER, params.user);
      }

      // OpenAI-specific attributes
      if (params.n !== undefined) {
        span.setAttribute(Attrs.OPENAI_REQUEST_N, params.n);
      }

      // Set input messages
      if (params.messages) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(params.messages));
      }

      // Set streaming flag
      if (params.stream) {
        span.setAttribute(Attrs.BROKLE_STREAMING, true);
      }

      try {
        // Call original OpenAI API
        const response = await originalFn.apply(this, args);

        // Extract and set response attributes
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

        // Set output messages
        if (attrs.outputMessages) {
          span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(attrs.outputMessages));
        }

        // Set usage metrics
        if (attrs.usage) {
          span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.promptTokens);
          span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.completionTokens);
          span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
        }

        // Set latency
        const latency = Date.now() - startTime;
        span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

        return response;
      } catch (error) {
        // Error already recorded by client.traced()
        throw error;
      }
    });
  };
}

/**
 * Wraps text completion API call with tracing
 */
function tracedCompletion(originalFn: Function, brokleClient: any) {
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `completion ${model}`;

    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_OBSERVATION_TYPE, 'generation');
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

      try {
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
      } catch (error) {
        throw error;
      }
    });
  };
}

/**
 * Wraps embeddings API call with tracing
 */
function tracedEmbedding(originalFn: Function, brokleClient: any) {
  return async function (this: any, ...args: any[]) {
    const params = args[0];
    const model = params.model || 'unknown';
    const spanName = `embedding ${model}`;

    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_OBSERVATION_TYPE, 'embedding');
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

      try {
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
      } catch (error) {
        throw error;
      }
    });
  };
}