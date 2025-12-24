/**
 * Query Module Type Definitions
 *
 * Types for querying production telemetry using filter expressions.
 */

/**
 * Options for querying spans
 */
export interface QueryOptions {
  /** Filter expression using Brokle Query syntax */
  filter: string;
  /** Start of time range (inclusive) */
  startTime?: Date;
  /** End of time range (inclusive) */
  endTime?: Date;
  /** Maximum number of spans to return (default: 1000) */
  limit?: number;
  /** Number of spans to skip for pagination (default: 0) */
  offset?: number;
}

/**
 * Token usage details extracted from span
 */
export interface TokenUsage {
  /** Number of tokens in the prompt */
  promptTokens?: number;
  /** Number of tokens in the completion */
  completionTokens?: number;
  /** Total tokens used */
  totalTokens?: number;
}

/**
 * Span event from trace
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Event timestamp (ISO format) */
  timestamp: string;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

/**
 * A span returned from a query
 *
 * Contains trace/span identifiers, timing information, and attributes.
 * Attributes include GenAI semantic convention fields for AI operations.
 */
export interface QueriedSpan {
  /** Unique identifier for the trace */
  traceId: string;
  /** Unique identifier for this span */
  spanId: string;
  /** Parent span ID (null for root spans) */
  parentSpanId?: string;
  /** Span operation name */
  name: string;
  /** Service that produced this span */
  serviceName?: string;
  /** Start timestamp (ISO format) */
  startTime: string;
  /** End timestamp (ISO format) */
  endTime?: string;
  /** Duration in microseconds */
  duration?: number;
  /** Span status */
  status?: 'unset' | 'ok' | 'error';
  /** Status message (usually for errors) */
  statusMessage?: string;
  /** Combined resource and span attributes */
  attributes: Record<string, unknown>;
  /** Span events */
  events?: SpanEvent[];

  // Convenience fields extracted from attributes
  /** Input content (from gen_ai.prompt.0.content or input attribute) */
  input?: string;
  /** Output content (from gen_ai.completion.0.content or output attribute) */
  output?: string;
  /** Model used (from gen_ai.response.model) */
  model?: string;
  /** Token usage details */
  tokenUsage?: TokenUsage;
}

/**
 * Result of a span query
 */
export interface QueryResult {
  /** Array of matching spans */
  spans: QueriedSpan[];
  /** Total number of matching spans (may be more than returned) */
  total: number;
  /** Whether more spans are available */
  hasMore: boolean;
  /** Offset for next page (if hasMore is true) */
  nextOffset?: number;
}

/**
 * Result of filter validation
 */
export interface ValidationResult {
  /** Whether the filter expression is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Validation message */
  message?: string;
}

/**
 * Configuration for the QueryManager
 */
export interface QueryManagerConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * API response envelope
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}

/**
 * Raw span data from API response
 */
export interface SpanData {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  span_name: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  status_message?: string;
  input?: string;
  output?: string;
  service_name?: string;
  model_name?: string;
  resource_attributes?: Record<string, string>;
  span_attributes?: Record<string, string>;
  usage_details?: Record<string, number>;
  events?: Array<{
    name: string;
    timestamp: string;
    attributes?: Record<string, unknown>;
  }>;
}

/**
 * Raw query response from API
 */
export interface SpanQueryResponse {
  spans: SpanData[];
  total_count: number;
  has_more: boolean;
}
