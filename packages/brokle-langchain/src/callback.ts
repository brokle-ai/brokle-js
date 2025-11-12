/**
 * LangChain.js Callback Handler with Brokle Tracing
 *
 * Integrates LangChain.js with Brokle observability using OTEL spans.
 * Handles the full lifecycle of LangChain runs: LLM calls, chains, tools, etc.
 */

import { BaseCallbackHandler } from 'langchain/callbacks';
import type { Serialized } from 'langchain/load/serializable';
import type { LLMResult } from 'langchain/schema';
import { getClient, Attrs, LLMProvider } from 'brokle';
import type { Span, Tracer, Context } from '@opentelemetry/api';
import { SpanStatusCode, trace, context } from '@opentelemetry/api';

/**
 * Configuration for BrokleLangChainCallback
 */
export interface BrokleLangChainCallbackConfig {
  /** User ID for filtering */
  userId?: string;
  /** Session ID for filtering */
  sessionId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Version for A/B testing and experiment tracking */
  version?: string;
  /** Debug logging */
  debug?: boolean;
}

/**
 * Brokle callback handler for LangChain.js
 *
 * Automatically traces LangChain operations:
 * - LLM calls (handleLLMStart, handleLLMEnd)
 * - Chain execution (handleChainStart, handleChainEnd)
 * - Tool calls (handleToolStart, handleToolEnd)
 * - Errors (handleLLMError, handleChainError, handleToolError)
 *
 * @example
 * ```typescript
 * import { BrokleLangChainCallback } from 'brokle-langchain';
 *
 * const callback = new BrokleLangChainCallback({
 *   userId: 'user-123',
 *   sessionId: 'session-456',
 *   tags: ['production'],
 * });
 *
 * const result = await chain.invoke(
 *   { input: 'What is AI?' },
 *   { callbacks: [callback] }
 * );
 *
 * await callback.flush();
 * ```
 */
export class BrokleLangChainCallback extends BaseCallbackHandler {
  name = 'brokle_langchain_callback';

  private tracer: Tracer;
  private spans: Map<string, Span>;
  private config: BrokleLangChainCallbackConfig;
  private userId?: string;
  private sessionId?: string;
  private tags: string[];
  private metadata: Record<string, unknown>;
  private version?: string;

  constructor(config: BrokleLangChainCallbackConfig = {}) {
    super();

    this.config = config;
    const client = getClient();
    this.tracer = client.getTracer();
    this.spans = new Map();

    // Store config values for use in callbacks
    this.userId = config.userId;
    this.sessionId = config.sessionId;
    this.tags = config.tags || [];
    this.metadata = config.metadata || {};
    this.version = config.version;
  }

  /**
   * Creates parent context for child spans
   * Uses OpenTelemetry context propagation to establish parent-child relationships
   *
   * @param parentRunId - Parent run ID from LangChain
   * @returns OpenTelemetry Context with parent span embedded, or undefined if no parent
   */
  private createParentContext(parentRunId?: string): Context | undefined {
    if (!parentRunId) {
      return undefined;
    }

    const parentSpan = this.spans.get(parentRunId);
    if (!parentSpan) {
      if (this.config.debug) {
        console.warn(`[Brokle LangChain] Parent span not found for runId: ${parentRunId}`);
      }
      return undefined;
    }

    // Get parent span context
    const parentSpanContext = parentSpan.spanContext();

    // Create new context with parent span embedded
    // This establishes the OTEL parent-child relationship
    return trace.setSpanContext(context.active(), parentSpanContext);
  }

  /**
   * Called when an LLM starts running
   *
   * IMPORTANT: LangChain.js passes tags and metadata in extraParams object
   * Signature: (llm, prompts, runId, parentRunId?, extraParams?)
   */
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, any>
  ): Promise<void> {
    // Extract tags and metadata from extraParams (LangChain.js pattern)
    const runTags = extraParams?.tags as string[] | undefined;
    const runMetadata = extraParams?.metadata as Record<string, unknown> | undefined;

    // Merge config tags with run-level tags
    const allTags = [...new Set([...this.tags, ...(runTags || [])])];

    // Merge config metadata with run-level metadata
    const allMetadata = { ...this.metadata, ...(runMetadata || {}) };

    // Extract model name and provider from LLM serialized object
    const llmType = llm.id?.[llm.id.length - 1] || 'unknown';
    const llmKwargs = llm as any;
    const model = llmKwargs.kwargs?.model_name || llmKwargs.kwargs?.model || llmType;

    // Determine provider from LLM type
    let provider = LLMProvider.OPENAI; // Default
    if (llmType.includes('openai')) {
      provider = LLMProvider.OPENAI;
    } else if (llmType.includes('anthropic') || llmType.includes('claude')) {
      provider = LLMProvider.ANTHROPIC;
    } else if (llmType.includes('google') || llmType.includes('vertex')) {
      provider = LLMProvider.GOOGLE;
    } else if (llmType.includes('cohere')) {
      provider = LLMProvider.COHERE;
    }

    const spanName = `chat ${model}`;

    // Create parent context to establish parent-child relationship
    const parentContext = this.createParentContext(parentRunId);

    // Build attributes object
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: provider,
      [Attrs.GEN_AI_OPERATION_NAME]: 'chat',
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
      [Attrs.GEN_AI_INPUT_MESSAGES]: JSON.stringify(
        prompts.map((prompt) => ({ role: 'user', content: prompt }))
      ),
    };

    // Add user/session context
    const userId = runMetadata?.brokleUserId || this.userId;
    const sessionId = runMetadata?.brokleSessionId || this.sessionId;

    if (userId) {
      attributes[Attrs.USER_ID] = userId;
    }
    if (sessionId) {
      attributes[Attrs.SESSION_ID] = sessionId;
    }
    if (allTags.length > 0) {
      attributes[Attrs.TAGS] = JSON.stringify(allTags);
    }
    if (Object.keys(allMetadata).length > 0) {
      attributes[Attrs.METADATA] = JSON.stringify(allMetadata);
    }
    if (this.version) {
      attributes[Attrs.BROKLE_VERSION] = this.version;
    }

    // Start span (manual control - keep open until handleLLMEnd)
    const span = this.tracer.startSpan(spanName, { attributes }, parentContext);

    // Store span by runId (keep open until handleLLMEnd)
    this.spans.set(runId, span);

    if (this.config.debug) {
      console.log(`[Brokle LangChain] LLM started: ${runId} (${model})`);
    }
  }

  /**
   * Called when an LLM finishes running
   */
  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      console.warn(`[Brokle LangChain] Span not found for runId: ${runId}`);
      return;
    }

    try {
      // Extract output messages
      const generations = output.generations[0];
      if (generations && generations.length > 0) {
        const outputMessages = generations.map((gen) => ({
          role: 'assistant',
          content: gen.text,
        }));
        span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify(outputMessages));
      }

      // Extract usage metrics (if available)
      if (output.llmOutput) {
        const llmOutput = output.llmOutput as any;

        if (llmOutput.tokenUsage) {
          span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, llmOutput.tokenUsage.promptTokens);
          span.setAttribute(
            Attrs.GEN_AI_USAGE_OUTPUT_TOKENS,
            llmOutput.tokenUsage.completionTokens
          );
          span.setAttribute(Attrs.BROKLE_USAGE_TOTAL_TOKENS, llmOutput.tokenUsage.totalTokens);
        }

        // Extract model name (actual model used)
        if (llmOutput.model_name) {
          span.setAttribute(Attrs.GEN_AI_RESPONSE_MODEL, llmOutput.model_name);
        }
      }

      // Set success status
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      // End span and remove from map
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] LLM ended: ${runId}`);
      }
    }
  }

  /**
   * Called when an LLM encounters an error
   */
  async handleLLMError(error: Error, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      return;
    }

    try {
      // Record exception
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } finally {
      // End span and remove from map
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] LLM error: ${runId}`, error.message);
      }
    }
  }

  /**
   * Called when a chain starts running
   */
  async handleChainStart(
    chain: Serialized,
    inputs: Record<string, any>,
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, any>
  ): Promise<void> {
    const runTags = extraParams?.tags as string[] | undefined;
    const runMetadata = extraParams?.metadata as Record<string, unknown> | undefined;

    const allTags = [...new Set([...this.tags, ...(runTags || [])])];
    const allMetadata = { ...this.metadata, ...(runMetadata || {}) };

    const chainType = chain.id?.[chain.id.length - 1] || 'chain';
    const spanName = `chain ${chainType}`;

    // Create parent context to establish parent-child relationship
    const parentContext = this.createParentContext(parentRunId);

    // Build attributes object
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'span',
      'chain.type': chainType,
      'chain.input': JSON.stringify(inputs),
    };

    // Add user/session context
    const userId = runMetadata?.brokleUserId || this.userId;
    const sessionId = runMetadata?.brokleSessionId || this.sessionId;

    if (userId) {
      attributes[Attrs.USER_ID] = userId;
    }
    if (sessionId) {
      attributes[Attrs.SESSION_ID] = sessionId;
    }
    if (allTags.length > 0) {
      attributes[Attrs.TAGS] = JSON.stringify(allTags);
    }
    if (Object.keys(allMetadata).length > 0) {
      attributes[Attrs.METADATA] = JSON.stringify(allMetadata);
    }
    if (this.version) {
      attributes[Attrs.BROKLE_VERSION] = this.version;
    }

    const span = this.tracer.startSpan(spanName, { attributes }, parentContext);

    this.spans.set(runId, span);

    if (this.config.debug) {
      console.log(`[Brokle LangChain] Chain started: ${runId} (${chainType})`);
    }
  }

  /**
   * Called when a chain finishes running
   */
  async handleChainEnd(outputs: Record<string, any>, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      return;
    }

    try {
      span.setAttribute('chain.output', JSON.stringify(outputs));
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] Chain ended: ${runId}`);
      }
    }
  }

  /**
   * Called when a chain encounters an error
   */
  async handleChainError(error: Error, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      return;
    }

    try {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } finally {
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] Chain error: ${runId}`, error.message);
      }
    }
  }

  /**
   * Called when a tool starts running
   */
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, any>
  ): Promise<void> {
    const runTags = extraParams?.tags as string[] | undefined;
    const runMetadata = extraParams?.metadata as Record<string, unknown> | undefined;

    const allTags = [...new Set([...this.tags, ...(runTags || [])])];
    const allMetadata = { ...this.metadata, ...(runMetadata || {}) };

    const toolName = tool.id?.[tool.id.length - 1] || 'tool';
    const spanName = `tool ${toolName}`;

    // Create parent context to establish parent-child relationship
    const parentContext = this.createParentContext(parentRunId);

    // Build attributes object
    const attributes: Record<string, any> = {
      [Attrs.BROKLE_SPAN_TYPE]: 'tool',
      'tool.name': toolName,
      'tool.input': input,
    };

    // Add user/session context
    const userId = runMetadata?.brokleUserId || this.userId;
    const sessionId = runMetadata?.brokleSessionId || this.sessionId;

    if (userId) {
      attributes[Attrs.USER_ID] = userId;
    }
    if (sessionId) {
      attributes[Attrs.SESSION_ID] = sessionId;
    }
    if (allTags.length > 0) {
      attributes[Attrs.TAGS] = JSON.stringify(allTags);
    }
    if (Object.keys(allMetadata).length > 0) {
      attributes[Attrs.METADATA] = JSON.stringify(allMetadata);
    }
    if (this.version) {
      attributes[Attrs.BROKLE_VERSION] = this.version;
    }

    const span = this.tracer.startSpan(spanName, { attributes }, parentContext);

    this.spans.set(runId, span);

    if (this.config.debug) {
      console.log(`[Brokle LangChain] Tool started: ${runId} (${toolName})`);
    }
  }

  /**
   * Called when a tool finishes running
   */
  async handleToolEnd(output: string, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      return;
    }

    try {
      span.setAttribute('tool.output', output);
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] Tool ended: ${runId}`);
      }
    }
  }

  /**
   * Called when a tool encounters an error
   */
  async handleToolError(error: Error, runId: string): Promise<void> {
    const span = this.spans.get(runId);
    if (!span) {
      return;
    }

    try {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } finally {
      span.end();
      this.spans.delete(runId);

      if (this.config.debug) {
        console.log(`[Brokle LangChain] Tool error: ${runId}`, error.message);
      }
    }
  }

  /**
   * Flush all pending spans to backend
   * Call this before process exit or at the end of serverless functions
   */
  async flush(): Promise<void> {
    const client = getClient();
    await client.flush();

    if (this.config.debug) {
      console.log('[Brokle LangChain] Flushed all spans');
    }
  }

  /**
   * Cleanup: end any open spans
   * Useful for cleanup in error scenarios
   */
  async cleanup(): Promise<void> {
    for (const [runId, span] of this.spans.entries()) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Span ended during cleanup',
      });
      span.end();
      this.spans.delete(runId);
    }

    if (this.config.debug) {
      console.log('[Brokle LangChain] Cleaned up open spans');
    }
  }
}