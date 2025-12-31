/**
 * Query Module
 *
 * Query production telemetry using filter expressions.
 *
 * @example
 * ```typescript
 * import { getClient } from 'brokle';
 *
 * const client = getClient();
 *
 * // Query spans with filter
 * const result = await client.query.query({
 *   filter: 'service.name=chatbot AND gen_ai.system=openai',
 *   startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 * });
 *
 * console.log(`Found ${result.total} spans`);
 *
 * // Stream with auto-pagination
 * for await (const span of client.query.queryIter({ filter: 'gen_ai.system=openai' })) {
 *   console.log(span.name, span.output);
 * }
 *
 * // Validate filter syntax
 * const validation = await client.query.validate('service.name=test');
 * ```
 *
 * @packageDocumentation
 */

// Manager
export { QueryManager } from './manager';

// Types
export type {
  QueryManagerConfig,
  QueryOptions,
  QueryResult,
  QueriedSpan,
  ValidationResult,
  TokenUsage,
  SpanEvent,
} from './types';

// Errors
export { QueryError, QueryAPIError, InvalidFilterError } from './errors';
