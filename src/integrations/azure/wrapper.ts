/**
 * Azure OpenAI SDK Wrapper with Automatic Tracing
 *
 * Extends the OpenAI wrapper with Azure-specific metadata extraction.
 * Uses Proxy pattern to intercept Azure OpenAI API calls.
 */

import type { AzureOpenAI } from 'openai';
import {
  getClient,
  Attrs,
  StreamingAccumulator,
  extractBrokleOptions,
  addPromptAttributes,
  type BrokleOptions,
} from '../../index';
import { SpanStatusCode } from '@opentelemetry/api';
import type { AzureOpenAIWrapperOptions, AzureChatCompletionAttributes, AzureMetadata } from './types';

export type { BrokleOptions };

const AZURE_PROVIDER = 'azure_openai';

// Azure-specific attribute keys
const AZURE_ATTRS = {
  DEPLOYMENT_NAME: 'azure_openai.deployment_name',
  API_VERSION: 'azure_openai.api_version',
  RESOURCE_NAME: 'azure_openai.resource_name',
} as const;

/**
 * Wraps Azure OpenAI client with automatic tracing
 *
 * @param client - AzureOpenAI client instance
 * @param options - Optional wrapper configuration
 * @returns Proxied AzureOpenAI client with tracing
 *
 * @example
 * ```typescript
 * import { AzureOpenAI } from 'openai';
 * import { wrapAzureOpenAI } from 'brokle/azure';
 *
 * const azure = wrapAzureOpenAI(new AzureOpenAI({
 *   endpoint: 'https://your-resource.openai.azure.com',
 *   apiVersion: '2024-02-15-preview',
 * }));
 *
 * const response = await azure.chat.completions.create({
 *   model: 'gpt-4',  // This is the deployment name
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export function wrapAzureOpenAI<T extends AzureOpenAI>(
  client: T,
  options?: AzureOpenAIWrapperOptions
): T {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapAzureOpenAI requires an AzureOpenAI client instance. ' +
        'Usage: wrapAzureOpenAI(new AzureOpenAI({ endpoint: "...", apiVersion: "..." }))'
    );
  }

  // Validate Azure OpenAI client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  if (!c.chat?.completions?.create && !c.completions?.create) {
    throw new Error(
      'Invalid AzureOpenAI client passed to wrapAzureOpenAI. ' +
        'The "openai" package (v4.0.0 or higher) is required. ' +
        'Install with: npm install openai'
    );
  }

  const brokleClient = getClient();

  if (!brokleClient.getConfig().enabled) {
    return client;
  }

  // Extract Azure metadata from client
  const azureMetadata = extractAzureMetadata(client);

  return createProxy(client, brokleClient, [], azureMetadata, options);
}

/**
 * Extract Azure metadata from client
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAzureMetadata(client: any): AzureMetadata {
  const metadata: AzureMetadata = {};

  try {
    // Try to extract from client configuration
    if (client._options) {
      metadata.endpoint = client._options.baseURL || client._options.endpoint;
      metadata.apiVersion = client._options.defaultQuery?.['api-version'] || client._options.apiVersion;
    }

    // Extract resource name from endpoint
    if (metadata.endpoint) {
      const match = metadata.endpoint.match(/https?:\/\/([^.]+)\./);
      if (match) {
        metadata.resourceName = match[1];
      }
    }
  } catch {
    // Ignore extraction errors
  }

  return metadata;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProxy(target: any, brokleClient: any, path: string[], azureMetadata: AzureMetadata, options?: AzureOpenAIWrapperOptions): any {
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
          return tracedChatCompletion(value.bind(obj), brokleClient, azureMetadata, options);
        }

        if (pathStr === 'completions.create') {
          return tracedCompletion(value.bind(obj), brokleClient, azureMetadata, options);
        }

        if (pathStr === 'embeddings.create') {
          return tracedEmbedding(value.bind(obj), brokleClient, azureMetadata, options);
        }

        return value.bind(obj);
      }

      if (value !== null && typeof value === 'object') {
        return createProxy(value, brokleClient, currentPath, azureMetadata, options);
      }

      return value;
    },
  });
}

/**
 * Add Azure metadata to span
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addAzureMetadata(span: any, metadata: AzureMetadata, deploymentName?: string) {
  if (deploymentName) {
    span.setAttribute(AZURE_ATTRS.DEPLOYMENT_NAME, deploymentName);
  }
  if (metadata.apiVersion) {
    span.setAttribute(AZURE_ATTRS.API_VERSION, metadata.apiVersion);
  }
  if (metadata.resourceName) {
    span.setAttribute(AZURE_ATTRS.RESOURCE_NAME, metadata.resourceName);
  }
}

/**
 * Traced chat.completions.create
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedChatCompletion(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  azureMetadata: AzureMetadata,
  _options?: AzureOpenAIWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `chat ${model}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: AZURE_PROVIDER,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };

    addPromptAttributes(attributes, brokleOpts);

    if (cleanParams.temperature !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_TEMPERATURE] = cleanParams.temperature;
    }
    if (cleanParams.max_tokens !== undefined) {
      attributes[Attrs.GEN_AI_REQUEST_MAX_TOKENS] = cleanParams.max_tokens;
    }
    if (cleanParams.messages) {
      attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(cleanParams.messages);
    }

    const isStreaming = cleanParams.stream === true;
    if (isStreaming) {
      attributes[Attrs.BROKLE_STREAMING] = true;
      return handleStreamingResponse(brokleClient, originalFn, args, cleanParams, spanName, attributes, azureMetadata, model);
    }

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      addAzureMetadata(span, azureMetadata, model);

      const response = await originalFn(...cleanArgs);
      const attrs = extractChatCompletionAttributes(response);

      if (attrs.responseId) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, attrs.responseId);
      }
      if (attrs.responseModel) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, attrs.responseModel);
      }
      if (attrs.finishReasons?.length) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify(attrs.finishReasons));
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
 * Handle streaming response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStreamingResponse(
  brokleClient: any,
  originalFn: (...args: any[]) => Promise<any>,
  args: any[],
  cleanParams: any,
  spanName: string,
  attributes: Record<string, any>,
  azureMetadata: AzureMetadata,
  deploymentName: string
): Promise<AsyncIterable<any>> {
  const tracer = brokleClient.getTracer();
  const span = tracer.startSpan(spanName, { attributes });

  addAzureMetadata(span, azureMetadata, deploymentName);

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
}

/**
 * Traced completions.create (legacy)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedCompletion(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  azureMetadata: AzureMetadata,
  _options?: AzureOpenAIWrapperOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const rawParams = args[0];
    const { cleanParams, brokleOpts } = extractBrokleOptions(rawParams);
    const model = cleanParams.model || 'unknown';
    const spanName = `completion ${model}`;

    const cleanArgs = [cleanParams, ...args.slice(1)];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await brokleClient.traced(spanName, async (span: any) => {
      const startTime = Date.now();

      span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, AZURE_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'text_completion');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);
      addAzureMetadata(span, azureMetadata, model);

      if (cleanParams.prompt) {
        const promptStr = Array.isArray(cleanParams.prompt)
          ? JSON.stringify(cleanParams.prompt)
          : cleanParams.prompt;
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, promptStr);
      }

      const response = await originalFn(...cleanArgs);

      if (response.id) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_ID, response.id);
      }
      if (response.model) {
        span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, response.model);
      }
      if (response.usage) {
        span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, response.usage.prompt_tokens);
        span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, response.usage.completion_tokens);
        span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, response.usage.total_tokens);
      }

      const latency = Date.now() - startTime;
      span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

      return response;
    });
  };
}

/**
 * Traced embeddings.create
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedEmbedding(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  azureMetadata: AzureMetadata,
  _options?: AzureOpenAIWrapperOptions
) {
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
      span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, AZURE_PROVIDER);
      span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'embeddings');
      span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, model);

      addPromptAttributes(span, brokleOpts);
      addAzureMetadata(span, azureMetadata, model);

      if (cleanParams.input) {
        const inputStr = Array.isArray(cleanParams.input)
          ? JSON.stringify(cleanParams.input)
          : cleanParams.input;
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, inputStr);
      }

      const response = await originalFn(...cleanArgs);

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

/**
 * Extract chat completion attributes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractChatCompletionAttributes(response: any): AzureChatCompletionAttributes {
  const attrs: AzureChatCompletionAttributes = {};

  try {
    attrs.responseId = response.id;
    attrs.responseModel = response.model;
    attrs.systemFingerprint = response.system_fingerprint;

    if (response.choices?.length) {
      attrs.finishReasons = response.choices.map((c: { finish_reason?: string }) => c.finish_reason).filter(Boolean);
      attrs.outputMessages = response.choices.map((c: { message?: { role?: string; content?: string | null; tool_calls?: unknown[] } }) => ({
        role: c.message?.role,
        content: c.message?.content,
        toolCalls: c.message?.tool_calls,
      }));
    }

    if (response.usage) {
      attrs.usage = {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
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
