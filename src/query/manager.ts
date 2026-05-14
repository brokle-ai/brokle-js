/**
 * Query Manager
 *
 * Manager for querying production telemetry using filter expressions.
 */

import { BrokleHttpClient } from '../_http';
import { BrokleError, ValidationError } from '../errors';
import { InvalidFilterError } from './errors';

// Backend error code for filter-parser rejection (see
// `pkg/errors/codes.go` → CodeInvalidFilterExpression). The SDK
// discriminates this 422 sub-kind from generic input-validation 422s
// via the `error.code` field on the response body — matches
// Stripe/OpenAI/JSON:API/RFC 9457 §3.1.3 convention.
const INVALID_FILTER_CODE = 'invalid_filter_expression';

function isInvalidFilterError(err: ValidationError): boolean {
  const response = err.details?.response as Record<string, unknown> | undefined;
  if (!response || typeof response !== 'object') return false;
  const errorBody = response.error as Record<string, unknown> | undefined;
  if (!errorBody || typeof errorBody !== 'object') return false;
  return errorBody.code === INVALID_FILTER_CODE;
}
import type {
  QueryManagerConfig,
  QueryOptions,
  QueryResult,
  QueriedSpan,
  ValidationResult,
  SpanQueryResponse,
  SpanData,
  TokenUsage,
} from './types';

/**
 * Transform raw span data from API to QueriedSpan
 */
function transformSpan(data: SpanData): QueriedSpan {
  // Merge resource and span attributes
  const attributes: Record<string, unknown> = {
    ...data.resource_attributes,
    ...data.span_attributes,
  };

  // Extract service name - check direct field first, then resource attributes
  const serviceName =
    data.service_name ||
    data.resource_attributes?.['service.name'] ||
    (attributes['service.name'] as string | undefined);

  // Extract token usage from usage_details
  let tokenUsage: TokenUsage | undefined;
  if (data.usage_details) {
    tokenUsage = {
      promptTokens: data.usage_details['prompt_tokens'],
      completionTokens: data.usage_details['completion_tokens'],
      totalTokens: data.usage_details['total_tokens'],
    };
  }

  // Extract model - check direct field first, then attributes
  const model =
    data.model_name ||
    (attributes['gen_ai.response.model'] as string | undefined) ||
    (attributes['gen_ai.request.model'] as string | undefined);

  // Convert duration from nanoseconds to microseconds
  const duration = data.duration ? Math.round(data.duration / 1000) : undefined;

  // Determine status from status_message or attributes
  let status: 'unset' | 'ok' | 'error' = 'unset';
  if (data.status_message && data.status_message.toLowerCase().includes('error')) {
    status = 'error';
  } else if (data.end_time) {
    status = 'ok';
  }

  return {
    traceId: data.trace_id,
    spanId: data.span_id,
    parentSpanId: data.parent_span_id,
    name: data.span_name,
    serviceName,
    startTime: data.start_time,
    endTime: data.end_time,
    duration,
    status,
    statusMessage: data.status_message,
    attributes,
    events: data.events?.map((e) => ({
      name: e.name,
      timestamp: e.timestamp,
      attributes: e.attributes,
    })),
    input: data.input,
    output: data.output,
    model,
    tokenUsage,
  };
}

/**
 * Query Manager for SDK span queries
 *
 * Provides methods for querying production telemetry using filter expressions.
 *
 * @example
 * ```typescript
 * // Query spans with filter
 * const result = await client.query.query({
 *   filter: 'service.name=chatbot AND gen_ai.provider.name=openai',
 *   startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 *   limit: 100,
 * });
 *
 * console.log(`Found ${result.total} spans`);
 * for (const span of result.spans) {
 *   console.log(span.name, span.input, span.output);
 * }
 *
 * // Validate filter syntax
 * const validation = await client.query.validate('service.name=test');
 * if (!validation.valid) {
 *   console.error('Invalid filter:', validation.error);
 * }
 * ```
 */
export class QueryManager {
  private http: BrokleHttpClient;
  private debug: boolean;

  constructor(config: QueryManagerConfig) {
    this.http = new BrokleHttpClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle QueryManager] ${message}`, ...args);
    }
  }

  /**
   * Query spans using a filter expression.
   *
   * @param options - Query options including filter, time range, and pagination
   * @returns Query result with matching spans and pagination info
   *
   * @example
   * ```typescript
   * // Basic query
   * const result = await client.query.query({
   *   filter: 'service.name=chatbot',
   * });
   *
   * // Query with time range
   * const result = await client.query.query({
   *   filter: 'gen_ai.provider.name=openai',
   *   startTime: new Date('2024-01-01'),
   *   endTime: new Date('2024-01-31'),
   * });
   *
   * // Paginated query
   * const result = await client.query.query({
   *   filter: 'service.name=chatbot',
   *   limit: 50,
   *   page: 2,
   * });
   * ```
   */
  async query(options: QueryOptions): Promise<QueryResult> {
    this.log('Querying spans', { filter: options.filter, limit: options.limit });

    const requestBody: Record<string, unknown> = {
      filter: options.filter,
    };

    if (options.startTime) {
      requestBody.start_time = options.startTime.toISOString();
    }
    if (options.endTime) {
      requestBody.end_time = options.endTime.toISOString();
    }
    if (options.limit !== undefined) {
      requestBody.limit = options.limit;
    }
    if (options.page !== undefined) {
      requestBody.page = options.page;
    }

    // Shared client raises typed BrokleError subclasses on 4xx/5xx.
    // A 422 is promoted to InvalidFilterError only when the backend
    // signals the filter-parser rejection via
    // `error.code === "invalid_filter_expression"`. Generic input
    // 422s (invalid limit/page/timestamp) propagate as the shared
    // ValidationError so callers can inspect
    // `err.details.response.error.errors` for per-field diagnostics.
    let data: SpanQueryResponse;
    try {
      data = await this.http.post<SpanQueryResponse>('/v1/spans/query', requestBody);
    } catch (error) {
      if (error instanceof ValidationError && isInvalidFilterError(error)) {
        throw new InvalidFilterError(options.filter, error.message);
      }
      throw error;
    }

    // Payload-shape failures on a 2xx response are a backend contract
    // violation — surface as BrokleError (typed family) so callers can
    // catch with one clause, not as a silent TypeError.
    let spans;
    try {
      spans = data.spans.map(transformSpan);
    } catch (error) {
      throw new BrokleError(
        `Failed to parse query response: ${(error as Error).message}`,
        {
          details: { response: data as unknown as Record<string, unknown> },
          originalError: error as Error,
        },
      );
    }
    const page = options.page ?? 1;

    this.log('Query completed', {
      count: spans.length,
      total: data.total_count,
      hasMore: data.has_more,
    });

    return {
      spans,
      total: data.total_count,
      hasMore: data.has_more,
      nextPage: data.has_more ? page + 1 : undefined,
    };
  }

  /**
   * Query spans with automatic pagination using an async iterator.
   *
   * This method automatically handles pagination and yields spans one at a time.
   * Useful for processing large result sets without loading all spans into memory.
   *
   * @param options - Query options (limit controls batch size, not total)
   * @yields QueriedSpan objects
   *
   * @example
   * ```typescript
   * // Process all matching spans
   * for await (const span of client.query.queryIter({
   *   filter: 'service.name=chatbot',
   * })) {
   *   console.log(span.name, span.output);
   * }
   *
   * // Collect into array
   * const spans: QueriedSpan[] = [];
   * for await (const span of client.query.queryIter({ filter: 'gen_ai.provider.name=openai' })) {
   *   spans.push(span);
   *   if (spans.length >= 1000) break; // Stop after 1000
   * }
   * ```
   */
  async *queryIter(options: QueryOptions): AsyncIterable<QueriedSpan> {
    const batchSize = options.limit ?? 100;
    let page = options.page ?? 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.query({
        ...options,
        limit: batchSize,
        page,
      });

      for (const span of result.spans) {
        yield span;
      }

      hasMore = result.hasMore;
      page = result.nextPage ?? page + 1;
    }
  }

  /**
   * Validate a filter expression without executing the query.
   *
   * Use this to check filter syntax before running expensive queries.
   *
   * @param filter - Filter expression to validate
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const validation = await client.query.validate('service.name=test AND gen_ai.provider.name=openai');
   * if (validation.valid) {
   *   console.log('Filter is valid');
   * } else {
   *   console.error('Invalid filter:', validation.error);
   * }
   * ```
   */
  async validate(filter: string): Promise<ValidationResult> {
    this.log('Validating filter', { filter });

    try {
      const data = await this.http.post<{ valid: boolean; message?: string }>(
        '/v1/spans/query/validate',
        { filter },
      );

      return {
        valid: data.valid,
        message: data.message,
      };
    } catch (error) {
      // 422 = the backend parser rejected the filter. The validate()
      // contract is a preflight check — surface the result as
      // ValidationResult so callers can inspect `.error` rather than
      // catching. Every other typed error (AuthenticationError,
      // ServerError, ConnectionError, etc.) propagates unchanged.
      if (error instanceof ValidationError) {
        return {
          valid: false,
          error: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Validate and throw if invalid.
   *
   * Convenience method that throws InvalidFilterError if the filter is invalid.
   *
   * @param filter - Filter expression to validate
   * @throws InvalidFilterError if filter is invalid
   */
  async validateOrThrow(filter: string): Promise<void> {
    const result = await this.validate(filter);
    if (!result.valid) {
      throw new InvalidFilterError(filter, result.error);
    }
  }
}
