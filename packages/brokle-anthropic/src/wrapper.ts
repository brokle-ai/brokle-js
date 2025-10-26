/**
 * Anthropic SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept Anthropic API calls and automatically
 * create OTEL spans with GenAI semantic conventions.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getClient, Attrs, LLMProvider } from 'brokle';
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

/**
 * Creates a recursive proxy for Anthropic client
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
        const pathStr = currentPath.join('.');

        if (pathStr === 'messages.create') {
          return tracedMessagesCreate(value.bind(obj), brokleClient);
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
 * Wraps messages.create API call with tracing
 */
function tracedMessagesCreate(originalFn: Function, brokleClient: any) {
  return async function (this: any, ...args: any[]) {
    const params = args[0]; // First argument is the request params

    // Extract model name for span name
    const model = params.model || 'unknown';
    const spanName = `chat ${model}`;

    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      // Set initial attributes
      span.setAttribute(Attrs.BROKLE_OBSERVATION_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.ANTHROPIC);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      // Set request parameters
      if (params.max_tokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, params.max_tokens);
      }
      if (params.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, params.temperature);
      }
      if (params.top_p !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, params.top_p);
      }
      if (params.top_k !== undefined) {
        span.setAttribute(Attrs.ANTHROPIC_REQUEST_TOP_K, params.top_k);
      }

      // Set input messages
      if (params.messages) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(params.messages));
      }

      // Set system prompt (if present)
      if (params.system) {
        const systemInstructions = [{ role: 'system', content: params.system }];
        span.setAttribute(Attrs.GEN_AI_SYSTEM_INSTRUCTIONS, JSON.stringify(systemInstructions));
      }

      // Set streaming flag
      if (params.stream) {
        span.setAttribute(Attrs.BROKLE_STREAMING, true);
      }

      try {
        // Call original Anthropic API
        const response = await originalFn.apply(this, args);

        // Extract and set response attributes
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

        // Set output messages
        if (attrs.outputContent) {
          span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([{
            role: 'assistant',
            content: attrs.outputContent,
          }]));
        }

        // Set usage metrics
        if (attrs.usage) {
          span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
          span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
          span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.inputTokens + attrs.usage.outputTokens);
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