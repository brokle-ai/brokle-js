/**
 * OpenTelemetry GenAI 1.28+ and Brokle custom attribute constants.
 *
 * Type-safe attribute keys to prevent typos and ensure OTEL compliance.
 * See ATTRIBUTE_MAPPING.md for cross-platform specification.
 */

export const BrokleOtelSpanAttributes = {
  // ========== GenAI Provider & Operation ==========
  GEN_AI_PROVIDER_NAME: 'gen_ai.provider.name',
  GEN_AI_OPERATION_NAME: 'gen_ai.operation.name',

  // ========== GenAI Request Parameters ==========
  GEN_AI_REQUEST_MODEL: 'gen_ai.request.model',
  GEN_AI_REQUEST_TEMPERATURE: 'gen_ai.request.temperature',
  GEN_AI_REQUEST_MAX_TOKENS: 'gen_ai.request.max_tokens',
  GEN_AI_REQUEST_TOP_P: 'gen_ai.request.top_p',
  GEN_AI_REQUEST_TOP_K: 'gen_ai.request.top_k',
  GEN_AI_REQUEST_FREQUENCY_PENALTY: 'gen_ai.request.frequency_penalty',
  GEN_AI_REQUEST_PRESENCE_PENALTY: 'gen_ai.request.presence_penalty',
  GEN_AI_REQUEST_STOP_SEQUENCES: 'gen_ai.request.stop_sequences',
  GEN_AI_REQUEST_USER: 'gen_ai.request.user',

  // ========== GenAI Response Metadata ==========
  GEN_AI_RESPONSE_ID: 'gen_ai.response.id',
  GEN_AI_RESPONSE_MODEL: 'gen_ai.response.model',
  GEN_AI_RESPONSE_FINISH_REASONS: 'gen_ai.response.finish_reasons',

  // ========== GenAI Messages ==========
  GEN_AI_INPUT_MESSAGES: 'gen_ai.input.messages',
  GEN_AI_OUTPUT_MESSAGES: 'gen_ai.output.messages',
  GEN_AI_SYSTEM_INSTRUCTIONS: 'gen_ai.system_instructions',

  // ========== OpenInference Generic Input/Output (Industry Standard) ==========
  // https://github.com/Arize-ai/openinference/blob/main/spec/semantic_conventions.md
  INPUT_VALUE: 'input.value',
  INPUT_MIME_TYPE: 'input.mime_type',
  OUTPUT_VALUE: 'output.value',
  OUTPUT_MIME_TYPE: 'output.mime_type',

  // ========== GenAI Usage ==========
  GEN_AI_USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',

  // ========== GenAI Extended Usage (Cache, Audio, Multi-modal) ==========
  // Cache tokens (Anthropic/OpenAI prompt caching)
  GEN_AI_USAGE_INPUT_TOKENS_CACHE_READ: 'gen_ai.usage.input_tokens.cache_read',
  GEN_AI_USAGE_INPUT_TOKENS_CACHE_CREATION: 'gen_ai.usage.input_tokens.cache_creation',

  // Audio tokens (OpenAI Whisper, TTS, Realtime API)
  GEN_AI_USAGE_INPUT_AUDIO_TOKENS: 'gen_ai.usage.input_audio_tokens',
  GEN_AI_USAGE_OUTPUT_AUDIO_TOKENS: 'gen_ai.usage.output_audio_tokens',

  // Reasoning tokens (OpenAI o1 models - internal chain-of-thought)
  GEN_AI_USAGE_REASONING_TOKENS: 'gen_ai.usage.reasoning_tokens',

  // Image tokens (GPT-4V, Claude 3.5 Sonnet Vision)
  GEN_AI_USAGE_IMAGE_TOKENS: 'gen_ai.usage.image_tokens',

  // Video tokens (Future multi-modal support)
  GEN_AI_USAGE_VIDEO_TOKENS: 'gen_ai.usage.video_tokens',

  // ========== OpenAI Specific ==========
  OPENAI_REQUEST_N: 'openai.request.n',
  OPENAI_REQUEST_SERVICE_TIER: 'openai.request.service_tier',
  OPENAI_RESPONSE_SYSTEM_FINGERPRINT: 'openai.response.system_fingerprint',

  // ========== Anthropic Specific ==========
  ANTHROPIC_REQUEST_TOP_K: 'anthropic.request.top_k',

  // ========== Brokle Custom ==========
  BROKLE_SPAN_TYPE: 'brokle.span.type',
  BROKLE_SPAN_LEVEL: 'brokle.span.level',
  BROKLE_SPAN_VERSION: 'brokle.span.version',  // Span-level version for A/B testing
  BROKLE_USAGE_TOTAL_TOKENS: 'brokle.usage.total_tokens',
  BROKLE_USAGE_LATENCY_MS: 'brokle.usage.latency_ms',
  BROKLE_STREAMING: 'brokle.streaming',
  BROKLE_PROJECT_ID: 'brokle.project_id',
  BROKLE_ENVIRONMENT: 'brokle.environment',
  BROKLE_VERSION: 'brokle.version',  // Trace-level version
  BROKLE_RELEASE: 'brokle.release',  // Release identifier

  // Note: brokle.cost.* attributes are set by BACKEND only (calculated from usage + model pricing)
  // SDKs should NOT set cost attributes - backend calculates costs server-side
  // Usage tracking is flexible - send any combination of token types (standard, cache, audio, reasoning, etc.)
  // Backend supports 10+ token types via flexible usage_details Maps - no schema changes needed for new types

  // ========== Brokle Prompt Management ==========
  BROKLE_PROMPT_ID: 'brokle.prompt.id',
  BROKLE_PROMPT_NAME: 'brokle.prompt.name',
  BROKLE_PROMPT_VERSION: 'brokle.prompt.version',

  // ========== Filterable Metadata ==========
  USER_ID: 'user.id',  // OTEL standard
  SESSION_ID: 'session.id',  // OTEL standard
  TAGS: 'tags',
  METADATA: 'metadata',
} as const;

export type AttributeKey = typeof BrokleOtelSpanAttributes[keyof typeof BrokleOtelSpanAttributes];

// Convenience alias
export const Attrs = BrokleOtelSpanAttributes;

/**
 * Span types for categorizing AI operations
 */
export enum SpanType {
  GENERATION = 'generation',
  SPAN = 'span',
  EVENT = 'event',
  TOOL = 'tool',
  AGENT = 'agent',        // AI agent operation
  CHAIN = 'chain',        // Chain of operations
  RETRIEVAL = 'retrieval',
  EMBEDDING = 'embedding',
}

/**
 * LLM provider identifiers
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  COHERE = 'cohere',
  AZURE = 'azure',
}

/**
 * GenAI operation types
 */
export enum OperationType {
  CHAT = 'chat',
  TEXT_COMPLETION = 'text_completion',
  EMBEDDINGS = 'embeddings',
  IMAGE_GENERATION = 'image_generation',
}

/**
 * Tool call structure for function calling
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Message structure for chat completions
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // For tool role messages
}

/**
 * GenAI-specific attributes for LLM operations
 */
export interface GenAIAttributes {
  provider?: LLMProvider;
  operation?: OperationType;
  model?: string;
  inputMessages?: Message[];
  outputMessages?: Message[];
  systemInstructions?: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  usage?: {
    input: number;
    output: number;
  };
  responseId?: string;
  responseModel?: string;
  finishReasons?: string[];
}

/**
 * Trace-level attributes
 */
export interface TraceAttributes {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}