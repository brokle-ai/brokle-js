/**
 * Annotation Queues Manager
 *
 * Manager for adding items to annotation queues for HITL evaluation workflows.
 * Follows Stripe/OpenAI namespace pattern: client.annotations.addItems()
 */

import type {
  AnnotationsManagerConfig,
  AddItemInput,
  AddItemsResult,
  ListItemsResult,
  ListItemsOptions,
  APIResponse,
  ObjectType,
} from './types';
import {
  AnnotationError,
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
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(config: AnnotationsManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle AnnotationsManager] ${message}`, ...args);
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
      this.handleHttpError(response.status, error);
    }

    return response.json() as Promise<T>;
  }

  private async httpGet<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.handleHttpError(response.status, error);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Handle HTTP errors and transform to appropriate exception
   */
  private handleHttpError(status: number, errorText: string): never {
    const lowerError = errorText.toLowerCase();

    if (status === 404 || lowerError.includes('not found')) {
      if (lowerError.includes('queue')) {
        throw new QueueNotFoundError(`Queue not found: ${errorText}`);
      }
      if (lowerError.includes('item')) {
        throw new ItemNotFoundError(`Item not found: ${errorText}`);
      }
    }

    if (status === 403 || lowerError.includes('locked') || lowerError.includes('forbidden')) {
      throw new ItemLockedError(`Item is locked by another user: ${errorText}`);
    }

    if (lowerError.includes('no items available') || lowerError.includes('no pending items')) {
      throw new NoItemsAvailableError(`No items available for annotation: ${errorText}`);
    }

    throw new AnnotationError(`API request failed (${status}): ${errorText}`);
  }

  /**
   * Unwrap API response envelope
   */
  private unwrapResponse<T>(response: APIResponse<T>): T {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new AnnotationError('Request failed with no error details');
      }
      throw new AnnotationError(`${error.code}: ${error.message}`);
    }

    if (response.data === undefined) {
      throw new AnnotationError('Response missing data field');
    }

    return response.data;
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

    const rawResponse = await this.httpPost<APIResponse<AddItemsResult>>(
      `/v1/annotation-queues/${queueId}/items`,
      payload
    );

    return this.unwrapResponse(rawResponse);
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

    const rawResponse = await this.httpGet<APIResponse<ListItemsResult>>(url);

    return this.unwrapResponse(rawResponse);
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
