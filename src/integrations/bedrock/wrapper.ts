/**
 * AWS Bedrock Runtime SDK Wrapper with Automatic Tracing
 *
 * Uses Proxy pattern to intercept BedrockRuntimeClient send() calls
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
import type { BedrockWrapperOptions, BedrockConverseAttributes } from './types';

export type { BrokleOptions };

const BEDROCK_PROVIDER = 'aws_bedrock';

// Bedrock-specific attribute keys
const BEDROCK_ATTRS = {
  MODEL_ID: 'bedrock.request.model_id',
  GUARDRAIL_ID: 'bedrock.request.guardrail_id',
  GUARDRAIL_VERSION: 'bedrock.request.guardrail_version',
  STOP_REASON: 'bedrock.response.stop_reason',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BedrockClient = any;

/**
 * Wraps AWS Bedrock Runtime client with automatic tracing
 *
 * @param client - BedrockRuntimeClient instance
 * @param options - Optional wrapper configuration
 * @returns Proxied BedrockRuntimeClient with tracing
 *
 * @example
 * ```typescript
 * import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
 * import { wrapBedrock } from 'brokle/bedrock';
 *
 * const bedrock = wrapBedrock(new BedrockRuntimeClient({ region: 'us-east-1' }));
 *
 * const response = await bedrock.send(new ConverseCommand({
 *   modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
 *   messages: [{ role: 'user', content: [{ text: 'Hello' }] }],
 * }));
 * ```
 */
export function wrapBedrock<T extends BedrockClient>(
  client: T,
  options?: BedrockWrapperOptions
): T {
  if (!client || typeof client !== 'object') {
    throw new Error(
      'wrapBedrock requires a BedrockRuntimeClient instance. ' +
        'Usage: wrapBedrock(new BedrockRuntimeClient({ region: "..." }))'
    );
  }

  // Validate Bedrock client structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (client as any).send !== 'function') {
    throw new Error(
      'Invalid BedrockRuntimeClient passed to wrapBedrock. ' +
        'The "@aws-sdk/client-bedrock-runtime" package is required. ' +
        'Install with: npm install @aws-sdk/client-bedrock-runtime'
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

      if (prop === 'send' && typeof value === 'function') {
        return tracedSend(value.bind(target), brokleClient, options);
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Traced send method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tracedSend(originalFn: (...args: any[]) => Promise<any>, brokleClient: any, options?: BedrockWrapperOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function (...args: any[]) {
    const command = args[0];
    const commandName = command?.constructor?.name || 'UnknownCommand';

    // Only trace Converse and ConverseStream commands
    if (commandName === 'ConverseCommand') {
      return tracedConverse(originalFn, brokleClient, command, args, options);
    }

    if (commandName === 'ConverseStreamCommand') {
      return tracedConverseStream(originalFn, brokleClient, command, args, options);
    }

    if (commandName === 'InvokeModelCommand') {
      return tracedInvokeModel(originalFn, brokleClient, command, args, options);
    }

    // Pass through other commands
    return originalFn(...args);
  };
}

/**
 * Traced Converse command
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tracedConverse(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  command: any,
  args: any[],
  _options?: BedrockWrapperOptions
) {
  const input = command.input || {};
  const { cleanParams, brokleOpts } = extractBrokleOptions(input);
  const modelId = cleanParams.modelId || 'unknown';
  const spanName = `chat ${modelId}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await brokleClient.traced(spanName, async (span: any) => {
    const startTime = Date.now();

    span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
    span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, BEDROCK_PROVIDER);
    span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'chat');
    span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, modelId);
    span.setAttribute(BEDROCK_ATTRS.MODEL_ID, modelId);

    addPromptAttributes(span, brokleOpts);

    // Capture request parameters
    if (cleanParams.inferenceConfig) {
      const config = cleanParams.inferenceConfig;
      if (config.temperature !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TEMPERATURE, config.temperature);
      }
      if (config.maxTokens !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_MAX_TOKENS, config.maxTokens);
      }
      if (config.topP !== undefined) {
        span.setAttribute(Attrs.GEN_AI_REQUEST_TOP_P, config.topP);
      }
    }

    // Capture guardrail config
    if (cleanParams.guardrailConfig) {
      span.setAttribute(BEDROCK_ATTRS.GUARDRAIL_ID, cleanParams.guardrailConfig.guardrailIdentifier);
      span.setAttribute(BEDROCK_ATTRS.GUARDRAIL_VERSION, cleanParams.guardrailConfig.guardrailVersion);
    }

    // Capture messages
    if (cleanParams.messages) {
      const formattedMessages = cleanParams.messages.map((m: { role?: string; content?: unknown[] }) => ({
        role: m.role,
        content: extractContentText(m.content || []),
      }));
      span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, JSON.stringify(formattedMessages));
    }

    // System prompt
    if (cleanParams.system) {
      span.setAttribute(Attrs.GEN_AI_SYSTEM_INSTRUCTIONS, JSON.stringify(cleanParams.system));
    }

    const response = await originalFn(...args);
    const attrs = extractConverseAttributes(response);

    if (attrs.stopReason) {
      span.setAttribute(BEDROCK_ATTRS.STOP_REASON, attrs.stopReason);
      span.setAttribute(Attrs.GEN_AI_RESPONSE_FINISH_REASONS, JSON.stringify([attrs.stopReason]));
    }
    if (attrs.outputMessages) {
      span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(attrs.outputMessages));
    }
    if (attrs.usage) {
      span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, attrs.usage.inputTokens);
      span.setAttribute(Attrs.GEN_AI_USAGE_OUTPUT_TOKENS, attrs.usage.outputTokens);
      span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, attrs.usage.totalTokens);
    }

    const latency = Date.now() - startTime;
    span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

    return response;
  });
}

/**
 * Traced ConverseStream command
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tracedConverseStream(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  command: any,
  args: any[],
  _options?: BedrockWrapperOptions
) {
  const input = command.input || {};
  const { cleanParams, brokleOpts } = extractBrokleOptions(input);
  const modelId = cleanParams.modelId || 'unknown';
  const spanName = `chat ${modelId}`;

  const tracer = brokleClient.getTracer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributes: Record<string, any> = {
    [Attrs.BROKLE_SPAN_TYPE]: 'generation',
    [Attrs.GEN_AI_PROVIDER_NAME]: BEDROCK_PROVIDER,
    [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
    [Attrs.GEN_AI_REQUEST_MODEL]: modelId,
    [BEDROCK_ATTRS.MODEL_ID]: modelId,
    [Attrs.BROKLE_STREAMING]: true,
  };

  addPromptAttributes(attributes, brokleOpts);

  if (cleanParams.messages) {
    const formattedMessages = cleanParams.messages.map((m: { role?: string; content?: unknown[] }) => ({
      role: m.role,
      content: extractContentText(m.content || []),
    }));
    attributes[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(formattedMessages);
  }

  const span = tracer.startSpan(spanName, { attributes });

  try {
    const startTime = Date.now();
    const response = await originalFn(...args);
    const accumulator = new StreamingAccumulator(startTime);

    // Wrap the stream
    if (response.stream) {
      const wrappedStream = wrapAsyncIterable(response.stream, span, accumulator);
      return {
        ...response,
        stream: wrappedStream,
      };
    }

    span.end();
    return response;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
    span.recordException(error as Error);
    span.end();
    throw error;
  }
}

/**
 * Traced InvokeModel command (legacy)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tracedInvokeModel(
  originalFn: (...args: any[]) => Promise<any>,
  brokleClient: any,
  command: any,
  args: any[],
  _options?: BedrockWrapperOptions
) {
  const input = command.input || {};
  const modelId = input.modelId || 'unknown';
  const spanName = `invoke ${modelId}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await brokleClient.traced(spanName, async (span: any) => {
    const startTime = Date.now();

    span.setAttribute(Attrs.BROKLE_SPAN_TYPE, 'generation');
    span.setAttribute(Attrs.GEN_AI_PROVIDER_NAME, BEDROCK_PROVIDER);
    span.setAttribute(Attrs.GEN_AI_OPERATION_NAME, 'invoke');
    span.setAttribute(Attrs.GEN_AI_REQUEST_MODEL, modelId);
    span.setAttribute(BEDROCK_ATTRS.MODEL_ID, modelId);

    // Body is typically a JSON string or buffer
    if (input.body) {
      try {
        const bodyStr = typeof input.body === 'string' ? input.body : new TextDecoder().decode(input.body);
        span.setAttribute(Attrs.GEN_AI_INPUT_MESSAGES, bodyStr);
      } catch {
        // Ignore body parsing errors
      }
    }

    const response = await originalFn(...args);

    // Parse response body
    if (response.body) {
      try {
        const bodyStr = new TextDecoder().decode(response.body);
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, bodyStr);
      } catch {
        // Ignore body parsing errors
      }
    }

    const latency = Date.now() - startTime;
    span.setAttribute(Attrs.BROKLE_USAGE_LATENCY_MS, latency);

    return response;
  });
}

/**
 * Extract text content from Bedrock content blocks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContentText(content: any[]): string {
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      if (typeof block === 'string') return block;
      if (block.text) return block.text;
      if (block.image) return '[image]';
      if (block.document) return '[document]';
      if (block.toolUse) return `[tool: ${block.toolUse.name}]`;
      if (block.toolResult) return `[tool_result: ${block.toolResult.toolUseId}]`;
      return JSON.stringify(block);
    })
    .join(' ');
}

/**
 * Extract Converse response attributes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractConverseAttributes(response: any): BedrockConverseAttributes {
  const attrs: BedrockConverseAttributes = {};

  try {
    attrs.stopReason = response.stopReason;

    if (response.output?.message) {
      const msg = response.output.message;
      attrs.outputMessages = [{
        role: msg.role,
        content: extractContentText(msg.content),
      }];
    }

    if (response.usage) {
      attrs.usage = {
        inputTokens: response.usage.inputTokens || 0,
        outputTokens: response.usage.outputTokens || 0,
        totalTokens: (response.usage.inputTokens || 0) + (response.usage.outputTokens || 0),
      };
    }

    if (response.metrics) {
      attrs.metrics = {
        latencyMs: response.metrics.latencyMs,
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
