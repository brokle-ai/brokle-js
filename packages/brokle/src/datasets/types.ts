/**
 * Dataset Type Definitions
 */

/**
 * Input for creating dataset items
 */
export interface DatasetItemInput {
  /** Input data for evaluation (arbitrary object) */
  input: Record<string, unknown>;
  /** Expected output for comparison (optional) */
  expected?: Record<string, unknown>;
  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * A single item in a dataset (response from API)
 */
export interface DatasetItem {
  /** Unique identifier for the item */
  id: string;
  /** ID of the parent dataset */
  dataset_id: string;
  /** Input data for evaluation */
  input: Record<string, unknown>;
  /** Expected output for comparison */
  expected?: Record<string, unknown>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when created */
  created_at: string;
}

/**
 * Dataset data from API response
 */
export interface DatasetData {
  /** Unique identifier for the dataset */
  id: string;
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when created */
  created_at: string;
  /** ISO timestamp when last updated */
  updated_at: string;
}

/**
 * Options for creating a dataset
 */
export interface CreateDatasetOptions {
  /** Dataset name (required) */
  name: string;
  /** Dataset description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for fetching items with pagination
 */
export interface GetItemsOptions {
  /** Maximum number of items to return (default: 50) */
  limit?: number;
  /** Number of items to skip (default: 0) */
  offset?: number;
}

/**
 * Options for listing datasets
 */
export interface ListDatasetsOptions {
  /** Maximum number of datasets to return (default: 50) */
  limit?: number;
  /** Number of datasets to skip (default: 0) */
  offset?: number;
}

/**
 * Internal configuration passed to Dataset
 */
export interface DatasetConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Configuration for the datasets manager
 */
export interface DatasetsManagerConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * API response envelope
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}
