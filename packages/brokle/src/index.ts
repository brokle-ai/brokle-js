/**
 * Brokle SDK - OpenTelemetry-native observability for AI applications
 *
 * @packageDocumentation
 */

// Core client
export { Brokle, getClient, resetClient } from './client';

// Configuration
export type { BrokleConfig, BrokleConfigInput } from './types/config';
export { loadFromEnv, validateConfig } from './config';

// Decorators
export { observe, traceFunction } from './decorators';
export type { ObserveOptions } from './decorators';

// Type-safe attributes
export {
  Attrs,
  BrokleOtelSpanAttributes,
  SpanType,
  LLMProvider,
  OperationType,
} from './types/attributes';

export type {
  AttributeKey,
  ToolCall,
  Message,
  GenAIAttributes,
  TraceAttributes,
} from './types/attributes';

// Exporter (for advanced use cases)
export { createBrokleExporter } from './exporter';

// Processor (for advanced use cases)
export { BrokleSpanProcessor } from './processor';

// Metrics (for GenAI metrics recording)
export {
  GenAIMetrics,
  createMeterProvider,
  createMeterProviderAsync,
  createMetricsExporter,
} from './metrics';

export {
  TOKEN_BOUNDARIES,
  DURATION_BOUNDARIES,
  TTFT_BOUNDARIES,
  INTER_TOKEN_BOUNDARIES,
  MetricNames,
} from './metrics/constants';

// Streaming (for streaming response instrumentation)
export { StreamingAccumulator } from './streaming/accumulator';
export type { StreamingResult } from './streaming/accumulator';

// Logs (for log export)
export { createLoggerProvider, createLoggerProviderAsync, createLogsExporter } from './logs';

// Transport (for custom transport configuration)
export { TransportType, CompressionType } from './transport';

export {
  createTraceExporter,
  createTraceExporterAsync,
  createMetricExporter,
  createMetricExporterAsync,
  createLogExporter,
  createLogExporterAsync,
} from './transport';

// Serialization utilities (for custom input/output handling)
export {
  serialize,
  serializeValue,
  serializeWithMime,
  serializeFunctionArgs,
  isChatMLFormat,
} from './utils/serializer';

// Masking utilities (for PII protection)
export { MaskingHelper } from './utils/masking';

// Prompt Management
export {
  Prompt,
  PromptManager,
  PromptCache,
  PromptError,
  PromptNotFoundError,
  PromptCompileError,
  PromptFetchError,
} from './prompt';
export type {
  PromptType,
  MessageRole,
  ChatMessage,
  TextTemplate,
  ChatTemplate,
  Template,
  ModelConfig,
  PromptConfig,
  PromptVersion,
  PromptData,
  GetPromptOptions,
  ListPromptsOptions,
  UpsertPromptRequest,
  OpenAIMessage,
  AnthropicMessage,
  AnthropicRequest,
  Variables,
  Fallback,
  TextFallback,
  ChatFallback,
} from './prompt';
export type { PromptManagerConfig, CacheOptions } from './prompt';

// Evaluations Management
export { EvaluationsManager, ScoreType, ScoreSource, EvaluationError, ScoreError, ScorerError } from './evaluations';
export type {
  EvaluationsManagerConfig,
  ScoreResult,
  ScoreValue,
  Scorer,
  ScorerArgs,
  ScoreOptions,
  BatchScoreOptions,
  ScoreResponse,
} from './evaluations';

// Scorers (re-export for convenience - also available via 'brokle/scorers')
export { ExactMatch, Contains, RegexMatch, JSONValid, LengthCheck, scorer, multiScorer } from './scorers';

// Wrapper utilities (for SDK wrapper packages)
export { extractBrokleOptions, addPromptAttributes } from './utils/wrappers';
export type { BrokleOptions } from './utils/wrappers';