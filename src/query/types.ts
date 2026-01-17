export interface QueryOptions {
  filter: string;
  startTime?: Date;
  endTime?: Date;
  /** Maximum spans to return (default: 1000) */
  limit?: number;
  /** Page number (default: 1, 1-indexed) */
  page?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

/**
 * A span returned from a query.
 * Attributes include GenAI semantic convention fields for AI operations.
 */
export interface QueriedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  serviceName?: string;
  startTime: string;
  endTime?: string;
  /** Duration in microseconds */
  duration?: number;
  status?: 'unset' | 'ok' | 'error';
  statusMessage?: string;
  attributes: Record<string, unknown>;
  events?: SpanEvent[];

  // Convenience fields extracted from attributes
  input?: string;
  output?: string;
  model?: string;
  tokenUsage?: TokenUsage;
}

export interface QueryResult {
  spans: QueriedSpan[];
  total: number;
  hasMore: boolean;
  nextPage?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export interface QueryManagerConfig {
  baseUrl: string;
  apiKey: string;
  debug?: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}

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

export interface SpanQueryResponse {
  spans: SpanData[];
  total_count: number;
  has_more: boolean;
}
