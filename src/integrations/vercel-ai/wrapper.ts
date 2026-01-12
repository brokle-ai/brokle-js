/**
 * Brokle Vercel AI SDK Integration
 *
 * Provides telemetry integration for Vercel AI SDK using its built-in
 * experimental_telemetry support with OpenTelemetry, enhanced with
 * response attribute extraction for token usage, finish reasons, and model info.
 */

import { trace } from '@opentelemetry/api';
import { getClient, Attrs } from '../../index';
import type {
  BrokleTelemetryConfig,
  ExperimentalTelemetry,
  AIFunctions,
  WrappedAIFunctions,
  BrokleAIOptions,
} from './types';
import {
  extractGenerateTextAttributes,
  extractGenerateObjectAttributes,
  extractEmbedAttributes,
  extractEmbedManyAttributes,
  type VercelAIResponseAttributes,
  type VercelAIEmbedAttributes,
} from './parser';

/**
 * Get Brokle telemetry configuration for Vercel AI SDK
 *
 * Returns an `experimental_telemetry` configuration object that integrates
 * Brokle's OpenTelemetry tracer with the Vercel AI SDK.
 *
 * @param config - Optional Brokle-specific configuration
 * @returns Telemetry configuration to spread into AI SDK function calls
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { getBrokleTelemetry } from 'brokle/vercel-ai';
 *
 * const result = await generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello, world!',
 *   experimental_telemetry: getBrokleTelemetry({
 *     functionId: 'my-chat-function',
 *     userId: 'user-123',
 *     sessionId: 'session-456',
 *   }),
 * });
 * ```
 */
export function getBrokleTelemetry(config?: BrokleTelemetryConfig): ExperimentalTelemetry {
  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return { isEnabled: false };
  }

  // Build metadata with Brokle-specific attributes
  const metadata: Record<string, string | number | boolean | undefined> = {
    ...config?.metadata,
  };

  // Add Brokle-specific attributes
  if (config?.userId) {
    metadata[Attrs.USER_ID] = config.userId;
  }
  if (config?.sessionId) {
    metadata[Attrs.SESSION_ID] = config.sessionId;
  }
  if (config?.promptId) {
    metadata[Attrs.BROKLE_PROMPT_ID] = config.promptId;
  }
  if (config?.promptVersion) {
    metadata[Attrs.BROKLE_PROMPT_VERSION] = config.promptVersion;
  }

  return {
    isEnabled: true,
    functionId: config?.functionId,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    tracer: brokleClient.getTracer(),
    recordInputs: config?.recordInputs ?? true,
    recordOutputs: config?.recordOutputs ?? true,
  };
}

/**
 * Set response attributes on the active span
 */
function setResponseAttributes(attrs: VercelAIResponseAttributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  if (attrs.usage) {
    if (attrs.usage.inputTokens !== undefined) {
      span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
    }
    if (attrs.usage.outputTokens !== undefined) {
      span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
    }
    if (attrs.usage.totalTokens !== undefined) {
      span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
    }
    if (attrs.usage.reasoningTokens !== undefined) {
      span.setAttribute('gen_ai.usage.reasoning_tokens', attrs.usage.reasoningTokens);
    }
  }

  if (attrs.finishReason) {
    span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, [attrs.finishReason]);
  }

  if (attrs.responseModel) {
    span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
  }

  if (attrs.responseId) {
    span.setAttribute('gen_ai.response.id', attrs.responseId);
  }
}

/**
 * Set embedding attributes on the active span
 */
function setEmbedAttributes(attrs: VercelAIEmbedAttributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;

  if (attrs.usage?.inputTokens !== undefined) {
    span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
  }

  if (attrs.responseModel) {
    span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
  }

  if (attrs.embeddingCount !== undefined) {
    span.setAttribute('gen_ai.embedding.count', attrs.embeddingCount);
  }
}

/**
 * Streaming functions that need special handling
 */
const STREAMING_FUNCTIONS = ['streamText', 'streamObject'];

/**
 * Embedding functions
 */
const EMBEDDING_FUNCTIONS = ['embed', 'embedMany'];

/**
 * Wrap streaming result to capture attributes when stream is consumed
 *
 * For streaming functions (streamText, streamObject), the usage and finish reason
 * are available as promises that resolve when the stream is fully consumed.
 * This wrapper intercepts those promises to extract and set span attributes.
 *
 * @param result - The streaming result from streamText/streamObject
 * @param functionName - The name of the function for attribute extraction
 * @returns Wrapped result with attribute capture
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapStreamingResult(result: any, _functionName: string): any {
  if (!result) return result;

  // Capture the current span context for later attribute setting
  const currentSpan = trace.getActiveSpan();

  // Helper to set attributes on the captured span
  const setAttrsOnSpan = (attrs: VercelAIResponseAttributes) => {
    if (!currentSpan) return;

    if (attrs.usage) {
      if (attrs.usage.inputTokens !== undefined) {
        currentSpan.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
      }
      if (attrs.usage.outputTokens !== undefined) {
        currentSpan.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
      }
      if (attrs.usage.totalTokens !== undefined) {
        currentSpan.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
      }
      if (attrs.usage.reasoningTokens !== undefined) {
        currentSpan.setAttribute('gen_ai.usage.reasoning_tokens', attrs.usage.reasoningTokens);
      }
    }

    if (attrs.finishReason) {
      currentSpan.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, [attrs.finishReason]);
    }

    if (attrs.responseModel) {
      currentSpan.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
    }

    if (attrs.responseId) {
      currentSpan.setAttribute('gen_ai.response.id', attrs.responseId);
    }
  };

  // Create a proxy that intercepts property access
  return new Proxy(result, {
    get(target, prop) {
      const value = target[prop];

      // Intercept the 'usage' promise
      if (prop === 'usage' && value && typeof value.then === 'function') {
        return value.then((usage: unknown) => {
          // Build attributes from resolved usage
          const attrs: VercelAIResponseAttributes = {
            usage: usage
              ? {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  inputTokens: (usage as any).inputTokens ?? 0,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  outputTokens: (usage as any).outputTokens ?? 0,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  totalTokens: (usage as any).totalTokens ?? 0,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  reasoningTokens: (usage as any).reasoningTokens,
                }
              : undefined,
          };
          setAttrsOnSpan(attrs);
          return usage;
        });
      }

      // Intercept the 'finishReason' promise
      if (prop === 'finishReason' && value && typeof value.then === 'function') {
        return value.then((reason: string) => {
          setAttrsOnSpan({ finishReason: reason });
          return reason;
        });
      }

      // Intercept the 'response' promise (contains id and modelId)
      if (prop === 'response' && value && typeof value.then === 'function') {
        return value.then((response: unknown) => {
          if (response) {
            setAttrsOnSpan({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              responseId: (response as any).id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              responseModel: (response as any).modelId,
            });
          }
          return response;
        });
      }

      // For all other properties, return as-is
      return value;
    },
  });
}

/**
 * Wrap Vercel AI SDK functions with automatic Brokle telemetry
 *
 * Creates wrapped versions of AI SDK functions that automatically inject
 * Brokle telemetry configuration. This provides a simpler API where you
 * don't need to manually add `experimental_telemetry` to every call.
 *
 * @param aiFunctions - Object containing AI SDK functions to wrap
 * @returns Wrapped functions with automatic telemetry
 *
 * @example
 * ```typescript
 * import { generateText, streamText } from 'ai';
 * import { wrapAI } from 'brokle/vercel-ai';
 *
 * const ai = wrapAI({ generateText, streamText });
 *
 * // All calls automatically traced
 * const result = await ai.generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello',
 *   // Optional: add Brokle-specific options
 *   brokle: {
 *     userId: 'user-123',
 *     sessionId: 'session-456',
 *   },
 * });
 *
 * // Streaming also works
 * const stream = await ai.streamText({
 *   model: openai('gpt-4'),
 *   prompt: 'Tell me a story',
 * });
 * ```
 */
export function wrapAI<T extends AIFunctions>(aiFunctions: T): WrappedAIFunctions<T> {
  const brokleClient = getClient();

  // If Brokle is disabled, return original functions
  if (!brokleClient.getConfig().enabled) {
    return aiFunctions as WrappedAIFunctions<T>;
  }

  const wrapped: Partial<WrappedAIFunctions<T>> = {};

  for (const [name, fn] of Object.entries(aiFunctions)) {
    if (typeof fn !== 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wrapped as any)[name] = fn;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapped as any)[name] = async function (params: Record<string, any> & BrokleAIOptions) {
      // Extract Brokle options
      const { brokle: brokleOptions, ...restParams } = params;

      // Build telemetry config
      const telemetryConfig = getBrokleTelemetry({
        functionId: brokleOptions?.functionId ?? name,
        ...brokleOptions,
      });

      // Merge with any existing experimental_telemetry
      const existingTelemetry = restParams.experimental_telemetry;
      const mergedTelemetry: ExperimentalTelemetry = {
        ...telemetryConfig,
        // Allow user to override specific fields
        ...(existingTelemetry && typeof existingTelemetry === 'object' ? existingTelemetry : {}),
        // Ensure isEnabled stays true if Brokle is enabled
        isEnabled: telemetryConfig.isEnabled,
        // Merge metadata
        metadata: {
          ...telemetryConfig.metadata,
          ...(existingTelemetry?.metadata || {}),
        },
      };

      // Call original function with merged telemetry
      const result = await fn({
        ...restParams,
        experimental_telemetry: mergedTelemetry,
      });

      // Extract and set response attributes based on function type
      if (result) {
        if (STREAMING_FUNCTIONS.includes(name)) {
          // For streaming, wrap the result to capture attributes when stream is consumed
          return wrapStreamingResult(result, name);
        } else if (EMBEDDING_FUNCTIONS.includes(name)) {
          // For embeddings
          const attrs =
            name === 'embedMany'
              ? extractEmbedManyAttributes(result)
              : extractEmbedAttributes(result);
          setEmbedAttributes(attrs);
        } else {
          // For non-streaming (generateText, generateObject)
          const attrs =
            name === 'generateObject'
              ? extractGenerateObjectAttributes(result)
              : extractGenerateTextAttributes(result);
          setResponseAttributes(attrs);
        }
      }

      return result;
    };
  }

  return wrapped as WrappedAIFunctions<T>;
}

/**
 * Create a telemetry-enabled wrapper for a single AI SDK function
 *
 * Useful when you only need to wrap one function or want more control.
 *
 * @param fn - The AI SDK function to wrap
 * @param defaultConfig - Default Brokle configuration to apply
 * @returns Wrapped function with automatic telemetry
 *
 * @example
 * ```typescript
 * import { generateText } from 'ai';
 * import { wrapAIFunction } from 'brokle/vercel-ai';
 *
 * const tracedGenerateText = wrapAIFunction(generateText, {
 *   functionId: 'chat-completion',
 * });
 *
 * const result = await tracedGenerateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Hello',
 * });
 * ```
 */
export function wrapAIFunction<TFn extends (...args: unknown[]) => Promise<unknown>>(
  fn: TFn,
  defaultConfig?: BrokleTelemetryConfig
): TFn {
  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async function (params: Record<string, any> & BrokleAIOptions) {
    const { brokle: brokleOptions, ...restParams } = params;

    // Merge default config with call-time options
    const mergedBrokleOptions: BrokleTelemetryConfig = {
      ...defaultConfig,
      ...brokleOptions,
    };

    const telemetryConfig = getBrokleTelemetry(mergedBrokleOptions);

    // Merge with existing telemetry
    const existingTelemetry = restParams.experimental_telemetry;
    const mergedTelemetry: ExperimentalTelemetry = {
      ...telemetryConfig,
      ...(existingTelemetry && typeof existingTelemetry === 'object' ? existingTelemetry : {}),
      isEnabled: telemetryConfig.isEnabled,
      metadata: {
        ...telemetryConfig.metadata,
        ...(existingTelemetry?.metadata || {}),
      },
    };

    const result = await fn({
      ...restParams,
      experimental_telemetry: mergedTelemetry,
    });

    // Extract and set response attributes
    // Since we don't know the function name, we extract as generateText
    // (works for generateObject too since they have the same structure)
    if (result) {
      const attrs = extractGenerateTextAttributes(result);
      setResponseAttributes(attrs);
    }

    return result;
  }) as TFn;
}
