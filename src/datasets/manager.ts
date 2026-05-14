/**
 * Datasets Manager
 *
 * Manager for creating and retrieving evaluation datasets.
 * Follows Stripe/OpenAI namespace pattern: client.datasets.create()
 */

import { BrokleHttpClient } from '../_http';
import { BrokleError } from '../errors';
import type {
  DatasetsManagerConfig,
  CreateDatasetOptions,
  ListDatasetsOptions,
  UpdateDatasetOptions,
  DatasetData,
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
  private http: BrokleHttpClient;
  // baseUrl + apiKey + debug are retained so we can construct
  // per-dataset `Dataset` instances (which own their own HTTP client).
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(config: DatasetsManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
    this.http = new BrokleHttpClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle DatasetsManager] ${message}`, ...args);
    }
  }

  /**
   * call wraps an HTTP call so any BrokleError subclass is re-thrown
   * as a DatasetError. Public consumers catching `DatasetError` keep
   * working unchanged across the envelope migration.
   */
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof DatasetError) throw error;
      if (error instanceof BrokleError) {
        throw new DatasetError(error.message);
      }
      if (error instanceof Error) {
        throw new DatasetError(error.message);
      }
      throw new DatasetError(String(error));
    }
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
    const data = await this.call(() => this.http.post<DatasetData>('/v1/datasets', options));

    return new Dataset(
      { baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug },
      data
    );
  }

  /**
   * Get an existing dataset by ID.
   *
   * @param datasetId - The dataset ID
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
    const data = await this.call(() =>
      this.http.get<DatasetData>(`/v1/datasets/${datasetId}`, {
        resourceType: 'dataset',
        identifier: datasetId,
      }),
    );

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

    // Inline `{data, pagination}` list shape.
    const body = await this.call(() =>
      this.http.get<{ data: DatasetData[]; pagination?: unknown }>(
        '/v1/datasets',
        { params: { limit, page } },
      ),
    );

    return (body.data ?? []).map(
      (d) => new Dataset({ baseUrl: this.baseUrl, apiKey: this.apiKey, debug: this.debug }, d),
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
    const data = await this.call(() =>
      this.http.patch<DatasetData>(`/v1/datasets/${datasetId}`, options, {
        resourceType: 'dataset',
        identifier: datasetId,
      }),
    );

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
    await this.call(() =>
      this.http.delete(`/v1/datasets/${datasetId}`, {
        resourceType: 'dataset',
        identifier: datasetId,
      }),
    );
  }
}
