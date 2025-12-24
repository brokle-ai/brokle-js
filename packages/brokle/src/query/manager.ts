/**
 * Query Manager
 *
 * Manager for querying production telemetry using filter expressions.
 */

import { QueryError, QueryAPIError, InvalidFilterError } from './errors';
import type {
  QueryManagerConfig,
  QueryOptions,
  QueryResult,
  QueriedSpan,
  ValidationResult,
  APIResponse,
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
 *   filter: 'service.name=chatbot AND gen_ai.system=openai',
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
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(config: QueryManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle QueryManager] ${message}`, ...args);
    }
  }

  private async httpPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new QueryAPIError(
        `API request failed (${response.status}): ${error}`,
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  private unwrapResponse<T>(response: APIResponse<T>): T {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new QueryError('Request failed with no error details');
      }
      throw new QueryAPIError(`${error.code}: ${error.message}`, undefined, error.code);
    }

    if (response.data === undefined) {
      throw new QueryError('Response missing data field');
    }

    return response.data;
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
   *   filter: 'gen_ai.system=openai',
   *   startTime: new Date('2024-01-01'),
   *   endTime: new Date('2024-01-31'),
   * });
   *
   * // Paginated query
   * const result = await client.query.query({
   *   filter: 'service.name=chatbot',
   *   limit: 50,
   *   offset: 100,
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
    if (options.offset !== undefined) {
      requestBody.offset = options.offset;
    }

    const rawResponse = await this.httpPost<APIResponse<SpanQueryResponse>>(
      '/v1/spans/query',
      requestBody
    );
    const data = this.unwrapResponse(rawResponse);

    const spans = data.spans.map(transformSpan);
    const limit = options.limit ?? 1000;
    const offset = options.offset ?? 0;

    this.log('Query completed', {
      count: spans.length,
      total: data.total_count,
      hasMore: data.has_more,
    });

    return {
      spans,
      total: data.total_count,
      hasMore: data.has_more,
      nextOffset: data.has_more ? offset + limit : undefined,
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
   * for await (const span of client.query.queryIter({ filter: 'gen_ai.system=openai' })) {
   *   spans.push(span);
   *   if (spans.length >= 1000) break; // Stop after 1000
   * }
   * ```
   */
  async *queryIter(options: QueryOptions): AsyncIterable<QueriedSpan> {
    const batchSize = options.limit ?? 100;
    let offset = options.offset ?? 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.query({
        ...options,
        limit: batchSize,
        offset,
      });

      for (const span of result.spans) {
        yield span;
      }

      hasMore = result.hasMore;
      offset = result.nextOffset ?? offset + batchSize;
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
   * const validation = await client.query.validate('service.name=test AND gen_ai.system=openai');
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
      const rawResponse = await this.httpPost<
        APIResponse<{ valid: boolean; message?: string }>
      >('/v1/spans/query/validate', { filter });
      const data = this.unwrapResponse(rawResponse);

      return {
        valid: data.valid,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof QueryAPIError) {
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
