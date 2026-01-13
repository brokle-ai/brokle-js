/**
 * Google GenAI SDK Wrapper with Automatic Tracing
 *
 * Supports the @google/genai SDK (GA as of May 2025)
 * for accessing Gemini models.
 *
 * Uses Proxy pattern to intercept Google GenAI API calls and
 * automatically create OTEL spans with GenAI semantic conventions.
 */

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
import type { GoogleGenAIWrapperOptions, GenerateContentAttributes } from './types';

export type { BrokleOptions };

// Google GenAI SDK types (we use 'any' to avoid requiring the package)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleGenAI = any;

/**
 * Wraps a Google GenAI client (@google/genai) with automatic tracing
 *
 * @param client - GoogleGenAI client instance from @google/genai
 * @param options - Optional wrapper configuration
 * @returns Proxied GoogleGenAI client with tracing
 *
 * @example
 * ```typescript
 * import { GoogleGenAI } from '@google/genai';
 * import { wrapGoogleGenAI } from 'brokle/google';
 *
 * const ai = wrapGoogleGenAI(new GoogleGenAI({ apiKey }));
 *
 * // All calls automatically traced
 * const response = await ai.models.generateContent({
 *   model: 'gemini-2.0-flash',
 *   contents: 'Hello!',
 * });
 * ```
 */
export function wrapGoogleGenAI<T extends GoogleGenAI>(
  client: T,
  options?: GoogleGenAIWrapperOptions
): T {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapGoogleGenAI requires a GoogleGenAI client instance. ' +
        'Usage: wrapGoogleGenAI(new GoogleGenAI({ apiKey }))'
    );
  }

  // Validate Google GenAI client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(client as any).models) {
    throw new Error(
      'Invalid GoogleGenAI client passed to wrapGoogleGenAI. ' +
        'The "@google/genai" package is required. ' +
        'Install with: npm install @google/genai'
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

      // Wrap the models namespace
      if (prop === 'models' && value && typeof value === 'object') {
        return wrapModelsNamespace(value, brokleClient, options);
      }

      return value;
    },
  });
}

/**
 * Wraps the models namespace with tracing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapModelsNamespace(models: any, brokleClient: any, options?: GoogleGenAIWrapperOptions): any {
  return new Proxy(models, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return target[prop];
      }

      const value = target[prop];

      if (prop === 'generateContent' && typeof value === 'function') {
        return tracedGenerateContent(value.bind(target), brokleClient, options);
      }

      if (prop === 'generateContentStream' && typeof value === 'function') {
        return tracedGenerateContentStream(value.bind(target), brokleClient, options);
      }

      if (prop === 'embedContent' && typeof value === 'function') {
        return tracedEmbedContent(value.bind(target), brokleClient, options);
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Traced generateContent for new SDK
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedGenerateContent(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  options?: GoogleGenAIWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const modelName = cleanParams?.model || 'gemini';
    const spanName = `generate ${modelName}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.GOOGLE);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, modelName);

      addPromptAttributes(span, brokleOpts);

      // Capture input - new SDK uses 'contents' field
      const inputText = extractInputTextNewSDK(cleanParams);
      if (inputText) {
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify([{ role: 'user', content: inputText }]));
      }

      // Extract generation config
      if (cleanParams?.config) {
        if (cleanParams.config.temperature !== undefined) {
          span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, cleanParams.config.temperature);
        }
        if (cleanParams.config.maxOutputTokens !== undefined) {
          span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, cleanParams.config.maxOutputTokens);
        }
        if (cleanParams.config.topP !== undefined) {
          span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, cleanParams.config.topP);
        }
      }

      const response = await originalFn(cleanParams, ...args.slice(1));
      const attrs = extractGenerateContentAttributesNewSDK(response, options);

      if (attrs.finishReason) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify([attrs.finishReason]));
      }
      if (attrs.outputText) {
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([{ role: 'assistant', content: attrs.outputText }]));
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
 * Traced generateContentStream for new SDK
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedGenerateContentStream(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: GoogleGenAIWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const modelName = cleanParams?.model || 'gemini';
    const spanName = `generate ${modelName}`;

    const tracer = brokleClient.getTracer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: LLMProvider.GOOGLE,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: modelName,
      [Attrs.BROKLE_STREAMING]: true,
    };

    addPromptAttributes(attributes, brokleOpts);

    const inputText = extractInputTextNewSDK(cleanParams);
    if (inputText) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify([{ role: 'user', content: inputText }]);
    }

    const span = tracer.startSpan(spanName, { attributes });

    try {
      const startTime = Date.now();
      const streamResult = await originalFn(cleanParams, ...args.slice(1));
      const accumulator = new StreamingAccumulator(startTime);

      // Wrap the async iterator
      const wrappedStream = wrapAsyncIterable(streamResult, span, accumulator);

      return wrappedStream;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      span.recordException(error as Error);
      span.end();
      throw error;
    }
  };
}

/**
 * Traced embedContent for new SDK
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedEmbedContent(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  _options?: GoogleGenAIWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const params = args[0];
    const modelName = params?.model || 'embedding';
    const spanName = `embedding ${modelName}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'embedding');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, LLMProvider.GOOGLE);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'embeddings');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, modelName);

      // Input for embeddings
      const content = params?.content || params?.contents;
      if (content) {
        const inputText = typeof content === 'string' ? content : JSON.stringify(content);
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, inputText);
      }

      const response = await originalFn(...args);

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Extract input text from new SDK format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInputTextNewSDK(params: any): string | null {
  if (!params) return null;

  // New SDK uses 'contents' field which can be string or array
  const contents = params.contents;

  if (typeof contents === 'string') {
    return contents;
  }

  if (Array.isArray(contents)) {
    // Array of content parts or messages
    return contents
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c?.parts) {
          return c.parts.map((p: { text?: string }) => p.text || '').join('');
        }
        if (c?.text) return c.text;
        return JSON.stringify(c);
      })
      .join('\n');
  }

  return null;
}

/**
 * Extract attributes from generateContent response (new SDK format)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGenerateContentAttributesNewSDK(response: any, _options?: GoogleGenAIWrapperOptions): GenerateContentAttributes {
  const attrs: GenerateContentAttributes = {};

  try {
    // New SDK response structure
    const candidates = response?.candidates;
    if (candidates && candidates.length > 0) {
      const candidate = candidates[0];
      attrs.finishReason = candidate.finishReason;

      // Extract text from content parts
      const content = candidate.content;
      if (content?.parts) {
        attrs.outputText = content.parts
          .map((p: { text?: string }) => p.text || '')
          .join('');
      }
    }

    // Usage metadata
    const usageMetadata = response?.usageMetadata;
    if (usageMetadata) {
      attrs.usage = {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      };
    }

    // Also check for text property directly (convenience accessor)
    if (!attrs.outputText && response?.text) {
      attrs.outputText = response.text;
    }
  } catch {
    // Ignore extraction errors
  }

  return attrs;
}

/**
 * Wrap async iterable stream with accumulator instrumentation
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
