/**
 * Dataset Class for Evaluation Workflows
 *
 * Provides Dataset class for managing evaluation datasets.
 * Datasets are collections of input/expected pairs used for systematic evaluation.
 *
 * @example
 * ```typescript
 * const dataset = await client.datasets.create({
 *   name: "qa-pairs",
 *   description: "Question-answer test cases"
 * });
 *
 * await dataset.insert([
 *   { input: { q: "2+2?" }, expected: { a: "4" } },
 * ]);
 *
 * for await (const item of dataset) {
 *   console.log(item.input, item.expected);
 * }
 * ```
 */

import type {
  DatasetConfig,
  DatasetData,
  DatasetItem,
  DatasetItemInput,
  GetItemsOptions,
  APIResponse,
} from './types';
import { DatasetError } from './errors';

/**
 * Dataset class for evaluation workflows
 *
 * Supports batch insert and auto-paginating async iteration.
 * Implements AsyncIterable for use with `for await...of` syntax.
 *
 * @example
 * ```typescript
 * // Create and populate a dataset
 * const dataset = await client.datasets.create({
 *   name: "qa-pairs",
 *   description: "Question-answer test cases"
 * });
 *
 * // Insert items in batch
 * const count = await dataset.insert([
 *   { input: { question: "What is 2+2?" }, expected: { answer: "4" } },
 *   { input: { question: "Capital of France?" }, expected: { answer: "Paris" } },
 * ]);
 * console.log(`Inserted ${count} items`);
 *
 * // Iterate with auto-pagination
 * for await (const item of dataset) {
 *   console.log(item.input, item.expected);
 * }
 *
 * // Get total count
 * const total = await dataset.count();
 * console.log(`Dataset has ${total} items`);
 * ```
 */
export class Dataset implements AsyncIterable<DatasetItem> {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _description?: string;
  private readonly _metadata?: Record<string, unknown>;
  private readonly _createdAt: string;
  private readonly _updatedAt: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly debug: boolean;

  constructor(config: DatasetConfig, data: DatasetData) {
    this._id = data.id;
    this._name = data.name;
    this._description = data.description;
    this._metadata = data.metadata;
    this._createdAt = data.created_at;
    this._updatedAt = data.updated_at;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get createdAt(): string {
    return this._createdAt;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle Dataset] ${message}`, ...args);
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
      throw new DatasetError(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private async httpGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DatasetError(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Unwrap API response envelope
   */
  private unwrapResponse<T>(response: APIResponse<T>): T {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new DatasetError('Request failed with no error details');
      }
      throw new DatasetError(`${error.code}: ${error.message}`);
    }

    if (response.data === undefined) {
      throw new DatasetError('Response missing data field');
    }

    return response.data;
  }

  /**
   * Insert items into the dataset.
   *
   * @param items - Array of items to insert. Each item must have an 'input' field.
   * @returns Number of items created
   *
   * @example
   * ```typescript
   * const count = await dataset.insert([
   *   { input: { q: "2+2?" }, expected: { a: "4" } },
   *   { input: { q: "Capital of France?" }, expected: { a: "Paris" } },
   * ]);
   * console.log(`Inserted ${count} items`);
   * ```
   */
  async insert(items: DatasetItemInput[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    this.log(`Inserting ${items.length} items into dataset ${this._id}`);

    const rawResponse = await this.httpPost<APIResponse<{ created: number }>>(
      `/v1/datasets/${this._id}/items`,
      { items }
    );

    const data = this.unwrapResponse(rawResponse);
    return data.created;
  }

  /**
   * Fetch items with pagination.
   *
   * @param options - Pagination options (limit, offset)
   * @returns Array of dataset items
   *
   * @example
   * ```typescript
   * const items = await dataset.getItems({ limit: 10, offset: 0 });
   * for (const item of items) {
   *   console.log(item.input);
   * }
   * ```
   */
  async getItems(options: GetItemsOptions = {}): Promise<DatasetItem[]> {
    const { limit = 50, offset = 0 } = options;

    this.log(`Fetching items from dataset ${this._id}: limit=${limit}, offset=${offset}`);

    const rawResponse = await this.httpGet<APIResponse<{ items: DatasetItem[]; total: number }>>(
      `/v1/datasets/${this._id}/items`,
      { limit, offset }
    );

    const data = this.unwrapResponse(rawResponse);
    return data.items;
  }

  /**
   * Get total item count.
   *
   * @returns Total number of items in the dataset
   *
   * @example
   * ```typescript
   * const total = await dataset.count();
   * console.log(`Dataset has ${total} items`);
   * ```
   */
  async count(): Promise<number> {
    const rawResponse = await this.httpGet<APIResponse<{ items: DatasetItem[]; total: number }>>(
      `/v1/datasets/${this._id}/items`,
      { limit: 1, offset: 0 }
    );

    const data = this.unwrapResponse(rawResponse);
    return data.total;
  }

  /**
   * Auto-paginating async iterator.
   *
   * Transparently fetches pages as needed.
   * Use with `for await...of` syntax.
   *
   * @example
   * ```typescript
   * for await (const item of dataset) {
   *   console.log(item.input, item.expected);
   * }
   * ```
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<DatasetItem> {
    let offset = 0;
    const limit = 50;

    while (true) {
      const items = await this.getItems({ limit, offset });

      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        yield item;
      }

      if (items.length < limit) {
        break;
      }

      offset += limit;
    }
  }

  toString(): string {
    return `Dataset(id='${this._id}', name='${this._name}')`;
  }
}
