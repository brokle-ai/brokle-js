/**
 * Datasets Manager
 *
 * Manager for creating and retrieving evaluation datasets.
 * Follows Stripe/OpenAI namespace pattern: client.datasets.create()
 */

import type {
  DatasetsManagerConfig,
  CreateDatasetOptions,
  ListDatasetsOptions,
  UpdateDatasetOptions,
  DatasetData,
  APIResponse,
} from './types';
import { Dataset } from './dataset';
import { DatasetError } from './errors';

/**
 * Datasets API manager
 *
 * Provides methods for creating and managing evaluation datasets.
 *
 * @example
 * ```typescript
 * // Create a dataset
 * const dataset = await client.datasets.create({
 *   name: "qa-pairs",
 *   description: "Question-answer test cases"
 * });
 *
 * // Get existing dataset by ID
 * const existing = await client.datasets.get("01HXYZ...");
 *
 * // List all datasets
 * const datasets = await client.datasets.list();
 * ```
 */
export class DatasetsManager {
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(config: DatasetsManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle DatasetsManager] ${message}`, ...args);
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

  private async httpPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
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

  private async httpDelete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new DatasetError(`API request failed (${response.status}): ${error}`);
    }
  }

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
   * Create a new dataset for evaluations.
   *
   * @param options - Dataset creation options
   * @returns Dataset instance for managing items
   *
   * @example
   * ```typescript
   * const dataset = await client.datasets.create({
   *   name: "qa-pairs",
   *   description: "Question-answer test cases"
   * });
   *
   * await dataset.insert([
   *   { input: { question: "What is 2+2?" }, expected: { answer: "4" } },
   * ]);
   * ```
   */
  async create(options: CreateDatasetOptions): Promise<Dataset> {
    this.log('Creating dataset', { name: options.name });

    const rawResponse = await this.httpPost<APIResponse<DatasetData>>('/v1/datasets', options);
    const data = this.unwrapResponse(rawResponse);

    return new Dataset(
      { baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug },
      data
    );
  }

  /**
   * Get an existing dataset by ID.
   *
   * @param datasetId - The dataset ID (ULID format)
   * @returns Dataset instance for managing items
   *
   * @example
   * ```typescript
   * const dataset = await client.datasets.get("01HXYZ...");
   *
   * for await (const item of dataset) {
   *   console.log(item.input, item.expected);
   * }
   * ```
   */
  async get(datasetId: string): Promise<Dataset> {
    this.log('Getting dataset', { id: datasetId });

    const rawResponse = await this.httpGet<APIResponse<DatasetData>>(`/v1/datasets/${datasetId}`);
    const data = this.unwrapResponse(rawResponse);

    return new Dataset(
      { baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug },
      data
    );
  }

  /**
   * List all datasets.
   *
   * @param options - Pagination options (limit, page)
   * @returns Array of Dataset instances
   *
   * @example
   * ```typescript
   * const datasets = await client.datasets.list({ limit: 10 });
   * for (const dataset of datasets) {
   *   console.log(dataset.name);
   * }
   * ```
   */
  async list(options: ListDatasetsOptions = {}): Promise<Dataset[]> {
    const { limit = 50, page = 1 } = options;

    this.log('Listing datasets', { limit, page });

    const rawResponse = await this.httpGet<APIResponse<DatasetData[]>>(
      '/v1/datasets',
      { limit, page }
    );

    const data = this.unwrapResponse(rawResponse);

    return data.map(
      (d) =>
        new Dataset({ baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug }, d)
    );
  }

  /**
   * Update a dataset.
   *
   * @param datasetId - The dataset ID to update
   * @param options - Update options (at least one field required)
   * @returns Updated Dataset instance
   *
   * @example
   * ```typescript
   * const updated = await client.datasets.update("01HXYZ...", {
   *   name: "new-name",
   *   description: "Updated description"
   * });
   * ```
   */
  async update(datasetId: string, options: UpdateDatasetOptions): Promise<Dataset> {
    if (!options.name && !options.description && options.metadata === undefined) {
      throw new DatasetError('At least one field (name, description, metadata) is required');
    }

    this.log('Updating dataset', { id: datasetId });

    const rawResponse = await this.httpPatch<APIResponse<DatasetData>>(
      `/v1/datasets/${datasetId}`,
      options
    );
    const data = this.unwrapResponse(rawResponse);

    return new Dataset(
      { baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug },
      data
    );
  }

  /**
   * Delete a dataset.
   *
   * @param datasetId - The dataset ID to delete
   *
   * @example
   * ```typescript
   * await client.datasets.delete("01HXYZ...");
   * ```
   */
  async delete(datasetId: string): Promise<void> {
    this.log('Deleting dataset', { id: datasetId });
    await this.httpDelete(`/v1/datasets/${datasetId}`);
  }
}
