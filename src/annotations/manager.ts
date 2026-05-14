/**
 * Annotation Queues Manager
 *
 * Manager for adding items to annotation queues for HITL evaluation workflows.
 * Follows Stripe/OpenAI namespace pattern: client.annotations.addItems()
 */

import { BrokleHttpClient } from '../_http';
import {
  AuthenticationError,
  BrokleError,
  NotFoundError,
} from '../errors';
import type {
  AnnotationsManagerConfig,
  AddItemInput,
  AddItemsResult,
  ListItemsResult,
  ListItemsOptions,
  ObjectType,
} from './types';
import {
  QueueNotFoundError,
  ItemNotFoundError,
  ItemLockedError,
  NoItemsAvailableError,
} from './errors';

/**
 * Annotation Queues API manager
 *
 * Provides methods for adding items to annotation queues.
 *
 * @example
 * ```typescript
 * // Add traces to a queue
 * const result = await client.annotations.addTraces(
 *   "queue123",
 *   ["trace1", "trace2", "trace3"],
 *   { priority: 5 }
 * );
 * console.log(`Added ${result.created} items`);
 *
 * // Add mixed items
 * await client.annotations.addItems("queue123", [
 *   { objectId: "trace1", objectType: "trace" },
 *   { objectId: "span1", objectType: "span", priority: 10 },
 * ]);
 * ```
 */
export class AnnotationsManager {
  private http: BrokleHttpClient;
  private debug: boolean;

  constructor(config: AnnotationsManagerConfig) {
    this.http = new BrokleHttpClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle AnnotationsManager] ${message}`, ...args);
    }
  }

  /**
   * classifyError lifts the shared HTTP client's typed exceptions
   * into axis-2 domain-specific errors for the narrow cases where
   * HTTP status alone cannot express the semantic:
   *
   *   - 404 on a queue path → QueueNotFoundError
   *   - 404 on an item path → ItemNotFoundError
   *   - 403 with "locked" message → ItemLockedError (queue-item lock
   *     contention, not auth)
   *   - 4xx with "no items available" → NoItemsAvailableError (empty
   *     queue state)
   *
   * Every other BrokleError subclass (AuthenticationError,
   * ValidationError, RateLimitError, ServerError, ConnectionError)
   * propagates unchanged so callers catch the shared HTTP family
   * uniformly across managers. NEVER blanket-wrap into an
   * `AnnotationError` — that loses the subclass and forces users to
   * memorise a parallel per-module hierarchy. See root CLAUDE.md
   * gotcha on the two-axis error model.
   */
  private classifyError(error: unknown): never {
    if (error instanceof NotFoundError) {
      const msg = error.message.toLowerCase();
      if (msg.includes('item')) throw new ItemNotFoundError(error.message);
      throw new QueueNotFoundError(error.message);
    }
    if (error instanceof AuthenticationError) {
      const msg = error.message.toLowerCase();
      if (msg.includes('locked') || msg.includes('forbidden')) {
        throw new ItemLockedError(`Item is locked: ${error.message}`);
      }
    }
    if (error instanceof BrokleError) {
      const msg = error.message.toLowerCase();
      if (msg.includes('no items available') || msg.includes('no pending items')) {
        throw new NoItemsAvailableError(`No items available for annotation: ${error.message}`);
      }
    }
    throw error; // Propagate shared-client errors unchanged.
  }

  /**
   * Add items to an annotation queue.
   *
   * Supports adding traces or spans for human annotation.
   *
   * @param queueId - ID of the annotation queue
   * @param items - Array of items to add
   * @returns Result with count of items created
   *
   * @example
   * ```typescript
   * const result = await client.annotations.addItems("queue123", [
   *   { objectId: "trace1", objectType: "trace" },
   *   { objectId: "span1", objectType: "span", priority: 10 },
   * ]);
   * console.log(`Added ${result.created} items`);
   * ```
   */
  async addItems(queueId: string, items: AddItemInput[]): Promise<AddItemsResult> {
    this.log(`Adding ${items.length} items to queue ${queueId}`);

    // Normalize items
    const normalizedItems = items.map((item) => ({
      object_id: item.objectId,
      object_type: item.objectType ?? 'trace',
      ...(item.priority !== undefined && { priority: item.priority }),
      ...(item.metadata && { metadata: item.metadata }),
    }));

    const payload = { items: normalizedItems };

    try {
      return await this.http.post<AddItemsResult>(
        `/v1/annotation-queues/${queueId}/items`,
        payload,
        { resourceType: 'queue', identifier: queueId },
      );
    } catch (error) {
      this.classifyError(error);
    }
  }

  /**
   * List items in an annotation queue.
   *
   * @param queueId - ID of the annotation queue
   * @param options - Optional filtering and pagination options
   * @returns Result with items array and total count
   *
   * @example
   * ```typescript
   * const result = await client.annotations.listItems("queue123", {
   *   status: "pending",
   *   limit: 20,
   * });
   * for (const item of result.items) {
   *   console.log(`${item.objectId}: ${item.status}`);
   * }
   * ```
   */
  async listItems(queueId: string, options: ListItemsOptions = {}): Promise<ListItemsResult> {
    this.log(`Listing items for queue ${queueId}`);

    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.limit !== undefined) params.set('limit', options.limit.toString());
    if (options.offset !== undefined) params.set('offset', options.offset.toString());

    const queryString = params.toString();
    const url = `/v1/annotation-queues/${queueId}/items${queryString ? `?${queryString}` : ''}`;

    try {
      return await this.http.get<ListItemsResult>(url, {
        resourceType: 'queue',
        identifier: queueId,
      });
    } catch (error) {
      this.classifyError(error);
    }
  }

  /**
   * Convenience method to add traces to an annotation queue.
   *
   * @param queueId - ID of the annotation queue
   * @param traceIds - Array of trace IDs to add
   * @param options - Optional priority and metadata
   * @returns Result with count of items created
   *
   * @example
   * ```typescript
   * const result = await client.annotations.addTraces(
   *   "queue123",
   *   ["trace1", "trace2", "trace3"],
   *   { priority: 5 }
   * );
   * ```
   */
  async addTraces(
    queueId: string,
    traceIds: string[],
    options: { priority?: number; metadata?: Record<string, unknown> } = {}
  ): Promise<AddItemsResult> {
    const items: AddItemInput[] = traceIds.map((traceId) => ({
      objectId: traceId,
      objectType: 'trace' as ObjectType,
      priority: options.priority,
      metadata: options.metadata,
    }));

    return this.addItems(queueId, items);
  }

  /**
   * Convenience method to add spans to an annotation queue.
   *
   * @param queueId - ID of the annotation queue
   * @param spanIds - Array of span IDs to add
   * @param options - Optional priority and metadata
   * @returns Result with count of items created
   *
   * @example
   * ```typescript
   * const result = await client.annotations.addSpans(
   *   "queue123",
   *   ["span1", "span2"],
   *   { priority: 10 }
   * );
   * ```
   */
  async addSpans(
    queueId: string,
    spanIds: string[],
    options: { priority?: number; metadata?: Record<string, unknown> } = {}
  ): Promise<AddItemsResult> {
    const items: AddItemInput[] = spanIds.map((spanId) => ({
      objectId: spanId,
      objectType: 'span' as ObjectType,
      priority: options.priority,
      metadata: options.metadata,
    }));

    return this.addItems(queueId, items);
  }
}
