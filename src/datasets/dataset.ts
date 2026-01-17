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
  KeysMapping,
  BulkImportResult,
  ImportOptions,
  CSVColumnMapping,
  CSVImportOptions,
  DatasetVersion,
  DatasetWithVersionInfo,
  CreateVersionOptions,
  PinVersionOptions,
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

  private extractTotal<T>(response: APIResponse<T>): number {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new DatasetError('Request failed with no error details');
      }
      throw new DatasetError(`${error.code}: ${error.message}`);
    }

    return response.meta?.pagination?.total ?? 0;
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
   * @param options - Pagination options (limit, page)
   * @returns Array of dataset items
   *
   * @example
   * ```typescript
   * const items = await dataset.getItems({ limit: 10, page: 1 });
   * for (const item of items) {
   *   console.log(item.input);
   * }
   * ```
   */
  async getItems(options: GetItemsOptions = {}): Promise<DatasetItem[]> {
    const { limit = 50, page = 1 } = options;

    this.log(`Fetching items from dataset ${this._id}: limit=${limit}, page=${page}`);

    const rawResponse = await this.httpGet<APIResponse<DatasetItem[]>>(
      `/v1/datasets/${this._id}/items`,
      { limit, page }
    );

    return this.unwrapResponse(rawResponse);
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
    const rawResponse = await this.httpGet<APIResponse<DatasetItem[]>>(
      `/v1/datasets/${this._id}/items`,
      { limit: 1, page: 1 }
    );

    return this.extractTotal(rawResponse);
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
    let page = 1;
    const limit = 50;

    while (true) {
      const items = await this.getItems({ limit, page });

      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        yield item;
      }

      if (items.length < limit) {
        break;
      }

      page += 1;
    }
  }

  toString(): string {
    return `Dataset(id='${this._id}', name='${this._name}')`;
  }

  // ===========================================================================
  // Import Methods
  // ===========================================================================

  /**
   * Import dataset items from a JSON file.
   *
   * Supports both JSON array files and JSONL (one object per line) files.
   *
   * @param filePath - Path to JSON or JSONL file
   * @param options - Import options (keysMapping, deduplicate)
   * @returns BulkImportResult with created/skipped counts
   *
   * @example
   * ```typescript
   * const result = await dataset.insertFromJson('./data.json');
   * console.log(`Created: ${result.created}, Skipped: ${result.skipped}`);
   * ```
   */
  async insertFromJson(filePath: string, options: ImportOptions = {}): Promise<BulkImportResult> {
    const fs = await import('fs/promises');
    this.log(`Importing items from ${filePath}`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const trimmed = content.trim();

      let items: Record<string, unknown>[];

      // Try parsing as JSON array first
      try {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Try parsing as JSONL (one JSON object per line)
        items = trimmed
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line.trim()));
      }

      return this.importItems(items, options);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new DatasetError(`File not found: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new DatasetError(`Invalid JSON in ${filePath}: ${error.message}`);
      }
      throw new DatasetError(`Failed to import from JSON: ${error}`);
    }
  }

  /**
   * Create dataset items from production traces (OTEL-native).
   *
   * This is Brokle's differentiating feature - no competitor exposes this in SDK.
   * Extracts input/output from trace spans to create evaluation dataset items.
   *
   * @param traceIds - Array of trace IDs to import from
   * @param options - Import options (keysMapping, deduplicate)
   * @returns BulkImportResult with created/skipped counts
   *
   * @example
   * ```typescript
   * const result = await dataset.fromTraces(['01HXYZ...', '01HABC...']);
   * console.log(`Created ${result.created} items from traces`);
   * ```
   */
  async fromTraces(traceIds: string[], options: ImportOptions = {}): Promise<BulkImportResult> {
    if (traceIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    this.log(`Creating items from ${traceIds.length} traces`);

    const payload: Record<string, unknown> = {
      trace_ids: traceIds,
      deduplicate: options.deduplicate ?? true,
    };

    if (options.keysMapping) {
      payload.keys_mapping = this.serializeKeysMapping(options.keysMapping);
    }

    const rawResponse = await this.httpPost<APIResponse<BulkImportResult>>(
      `/v1/datasets/${this._id}/items/from-traces`,
      payload
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Create dataset items from production spans.
   *
   * @param spanIds - Array of span IDs to import from
   * @param options - Import options (keysMapping, deduplicate)
   * @returns BulkImportResult with created/skipped counts
   *
   * @example
   * ```typescript
   * const result = await dataset.fromSpans(['span1', 'span2']);
   * console.log(`Created ${result.created} items from spans`);
   * ```
   */
  async fromSpans(spanIds: string[], options: ImportOptions = {}): Promise<BulkImportResult> {
    if (spanIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    this.log(`Creating items from ${spanIds.length} spans`);

    const payload: Record<string, unknown> = {
      span_ids: spanIds,
      deduplicate: options.deduplicate ?? true,
    };

    if (options.keysMapping) {
      payload.keys_mapping = this.serializeKeysMapping(options.keysMapping);
    }

    const rawResponse = await this.httpPost<APIResponse<BulkImportResult>>(
      `/v1/datasets/${this._id}/items/from-spans`,
      payload
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Internal method to import items via API.
   */
  private async importItems(
    items: Record<string, unknown>[],
    options: ImportOptions
  ): Promise<BulkImportResult> {
    if (items.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const payload: Record<string, unknown> = {
      items,
      deduplicate: options.deduplicate ?? true,
    };

    if (options.keysMapping) {
      payload.keys_mapping = this.serializeKeysMapping(options.keysMapping);
    }

    const rawResponse = await this.httpPost<APIResponse<BulkImportResult>>(
      `/v1/datasets/${this._id}/items/import-json`,
      payload
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Convert KeysMapping to API format (snake_case).
   */
  private serializeKeysMapping(mapping: KeysMapping): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    if (mapping.inputKeys) result.input_keys = mapping.inputKeys;
    if (mapping.expectedKeys) result.expected_keys = mapping.expectedKeys;
    if (mapping.metadataKeys) result.metadata_keys = mapping.metadataKeys;
    return result;
  }

  /**
   * Convert CSVColumnMapping to API format (snake_case).
   */
  private serializeColumnMapping(mapping: CSVColumnMapping): Record<string, unknown> {
    const result: Record<string, unknown> = {
      input_column: mapping.inputColumn,
    };
    if (mapping.expectedColumn) result.expected_column = mapping.expectedColumn;
    if (mapping.metadataColumns) result.metadata_columns = mapping.metadataColumns;
    return result;
  }

  /**
   * Import dataset items from a CSV file.
   *
   * Reads a CSV file from disk and imports items using the specified column mapping.
   * The CSV content is sent to the backend API for processing.
   *
   * @param filePath - Path to the CSV file to import
   * @param columnMapping - Column mapping specifying which columns to use
   * @param options - Import options (hasHeader, deduplicate)
   * @returns BulkImportResult with created/skipped counts
   *
   * @example
   * ```typescript
   * const result = await dataset.insertFromCsv('./qa_pairs.csv', {
   *   inputColumn: 'question',
   *   expectedColumn: 'answer',
   *   metadataColumns: ['category', 'difficulty'],
   * });
   * console.log(`Created: ${result.created}, Skipped: ${result.skipped}`);
   * ```
   */
  async insertFromCsv(
    filePath: string,
    columnMapping: CSVColumnMapping,
    options: CSVImportOptions = {}
  ): Promise<BulkImportResult> {
    const fs = await import('fs/promises');
    this.log(`Importing items from CSV file: ${filePath}`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      const payload: Record<string, unknown> = {
        content,
        column_mapping: this.serializeColumnMapping(columnMapping),
        has_header: options.hasHeader ?? true,
        deduplicate: options.deduplicate ?? true,
      };

      const rawResponse = await this.httpPost<APIResponse<BulkImportResult>>(
        `/v1/datasets/${this._id}/items/import-csv`,
        payload
      );

      return this.unwrapResponse(rawResponse);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new DatasetError(`File not found: ${filePath}`);
      }
      throw new DatasetError(`Failed to import from CSV: ${error}`);
    }
  }

  // ===========================================================================
  // Export Methods
  // ===========================================================================

  /**
   * Export dataset items to a JSON file.
   *
   * @param filePath - Path to write the JSON file
   *
   * @example
   * ```typescript
   * await dataset.toJson('./exported_data.json');
   * ```
   */
  async toJson(filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    this.log(`Exporting items to ${filePath}`);

    try {
      const items = await this.exportItems();
      await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (error) {
      throw new DatasetError(`Failed to export to JSON: ${error}`);
    }
  }

  /**
   * Export all dataset items as an array.
   *
   * @returns Array of all dataset items
   *
   * @example
   * ```typescript
   * const items = await dataset.export();
   * console.log(`Exported ${items.length} items`);
   * ```
   */
  async export(): Promise<DatasetItem[]> {
    this.log('Exporting all items');
    return this.exportItems();
  }

  private async exportItems(): Promise<DatasetItem[]> {
    const rawResponse = await this.httpGet<APIResponse<DatasetItem[]>>(
      `/v1/datasets/${this._id}/items/export`
    );

    return this.unwrapResponse(rawResponse);
  }

  // ===========================================================================
  // Dataset Versioning Methods
  // ===========================================================================

  /**
   * Create a new version (snapshot) of the current dataset items.
   *
   * Versions allow you to freeze the dataset at a point in time for reproducible evaluations.
   * Each version captures all current items and assigns an auto-incremented version number.
   *
   * @param options - Optional version metadata (description, metadata)
   * @returns The created DatasetVersion
   *
   * @example
   * ```typescript
   * // Create a version before running an experiment
   * const version = await dataset.createVersion({
   *   description: "Pre-training dataset v1",
   *   metadata: { experiment_id: "exp_123" }
   * });
   * console.log(`Created version ${version.version} with ${version.item_count} items`);
   * ```
   */
  async createVersion(options: CreateVersionOptions = {}): Promise<DatasetVersion> {
    this.log(`Creating version for dataset ${this._id}`);

    const payload: Record<string, unknown> = {};
    if (options.description) payload.description = options.description;
    if (options.metadata) payload.metadata = options.metadata;

    const rawResponse = await this.httpPost<APIResponse<DatasetVersion>>(
      `/v1/datasets/${this._id}/versions`,
      payload
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * List all versions for this dataset.
   *
   * @returns Array of DatasetVersion objects
   *
   * @example
   * ```typescript
   * const versions = await dataset.listVersions();
   * for (const v of versions) {
   *   console.log(`Version ${v.version}: ${v.item_count} items`);
   * }
   * ```
   */
  async listVersions(): Promise<DatasetVersion[]> {
    this.log(`Listing versions for dataset ${this._id}`);

    const rawResponse = await this.httpGet<APIResponse<DatasetVersion[]>>(
      `/v1/datasets/${this._id}/versions`
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Get a specific version by ID.
   *
   * @param versionId - The version ID to retrieve
   * @returns The DatasetVersion
   *
   * @example
   * ```typescript
   * const version = await dataset.getVersion("01HXYZ...");
   * console.log(`Version ${version.version} has ${version.item_count} items`);
   * ```
   */
  async getVersion(versionId: string): Promise<DatasetVersion> {
    this.log(`Getting version ${versionId} for dataset ${this._id}`);

    const rawResponse = await this.httpGet<APIResponse<DatasetVersion>>(
      `/v1/datasets/${this._id}/versions/${versionId}`
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Get items for a specific version with pagination.
   *
   * @param versionId - The version ID to get items from
   * @param options - Pagination options (limit, offset)
   * @returns Object with items array and total count
   *
   * @example
   * ```typescript
   * const { items, total } = await dataset.getVersionItems("01HXYZ...", {
   *   limit: 10,
   *   offset: 0
   * });
   * console.log(`Fetched ${items.length} of ${total} items`);
   * ```
   */
  async getVersionItems(
    versionId: string,
    options: GetItemsOptions = {}
  ): Promise<{ items: DatasetItem[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    this.log(`Fetching items for version ${versionId}: limit=${limit}, offset=${offset}`);

    const rawResponse = await this.httpGet<APIResponse<{ items: DatasetItem[]; total: number }>>(
      `/v1/datasets/${this._id}/versions/${versionId}/items`,
      { limit, offset }
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Pin this dataset to a specific version.
   *
   * When pinned, the dataset will always return items from that version instead of live items.
   * This ensures reproducibility for evaluations and experiments.
   *
   * @param options - Pin options (versionId to pin, or null/undefined to unpin)
   * @returns The updated dataset with version info
   *
   * @example
   * ```typescript
   * // Pin to a specific version
   * await dataset.pinVersion({ versionId: "01HXYZ..." });
   *
   * // Unpin to return to live items
   * await dataset.pinVersion({ versionId: null });
   * ```
   */
  async pinVersion(options: PinVersionOptions = {}): Promise<DatasetWithVersionInfo> {
    this.log(`Pinning dataset ${this._id} to version ${options.versionId ?? 'unpinned'}`);

    const rawResponse = await this.httpPost<APIResponse<DatasetWithVersionInfo>>(
      `/v1/datasets/${this._id}/pin`,
      { version_id: options.versionId ?? null }
    );

    return this.unwrapResponse(rawResponse);
  }

  /**
   * Get this dataset with detailed version information.
   *
   * Returns the dataset along with its current pinned version (if any) and latest version.
   *
   * @returns DatasetWithVersionInfo containing current and latest version details
   *
   * @example
   * ```typescript
   * const info = await dataset.getInfo();
   * console.log(`Dataset: ${info.name}`);
   * if (info.current_version) {
   *   console.log(`Pinned to version ${info.current_version.version}`);
   * }
   * if (info.latest_version) {
   *   console.log(`Latest version: ${info.latest_version.version}`);
   * }
   * ```
   */
  async getInfo(): Promise<DatasetWithVersionInfo> {
    this.log(`Getting info for dataset ${this._id}`);

    const rawResponse = await this.httpGet<APIResponse<DatasetWithVersionInfo>>(
      `/v1/datasets/${this._id}/info`
    );

    return this.unwrapResponse(rawResponse);
  }
}
