/**
 * Datasets Module
 *
 * Manager for creating and managing evaluation datasets.
 * Follows Stripe/OpenAI namespace pattern: client.datasets.create()
 *
 * @example
 * ```typescript
 * import { getClient } from 'brokle';
 *
 * const client = getClient();
 *
 * // Create a dataset
 * const dataset = await client.datasets.create({
 *   name: "qa-pairs",
 *   description: "Question-answer test cases"
 * });
 *
 * // Insert items
 * await dataset.insert([
 *   { input: { question: "What is 2+2?" }, expected: { answer: "4" } },
 * ]);
 *
 * // Iterate with auto-pagination
 * for await (const item of dataset) {
 *   console.log(item.input, item.expected);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Manager
export { DatasetsManager } from './manager';
export type { DatasetsManagerConfig } from './types';

// Dataset class
export { Dataset } from './dataset';

// Types
export type {
  DatasetItem,
  DatasetItemInput,
  DatasetData,
  DatasetConfig,
  CreateDatasetOptions,
  GetItemsOptions,
  ListDatasetsOptions,
  APIResponse,
} from './types';

// Errors
export { DatasetError } from './errors';
