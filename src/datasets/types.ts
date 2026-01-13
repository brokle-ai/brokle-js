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
  /** Item source (manual, trace, span, csv, json, sdk) */
  source: DatasetItemSource;
  /** Source trace ID if created from trace */
  source_trace_id?: string;
  /** Source span ID if created from span */
  source_span_id?: string;
  /** ISO timestamp when created */
  created_at: string;
}

/**
 * Source type for dataset items
 */
export type DatasetItemSource = 'manual' | 'trace' | 'span' | 'csv' | 'json' | 'sdk';

/**
 * Field mapping for bulk import operations
 */
export interface KeysMapping {
  /** Keys to extract for input field */
  inputKeys?: string[];
  /** Keys to extract for expected field */
  expectedKeys?: string[];
  /** Keys to extract for metadata field */
  metadataKeys?: string[];
}

/**
 * Result of a bulk import operation
 */
export interface BulkImportResult {
  /** Number of items created */
  created: number;
  /** Number of items skipped (duplicates) */
  skipped: number;
  /** List of error messages */
  errors?: string[];
}

/**
 * Options for import operations
 */
export interface ImportOptions {
  /** Optional field mapping for extraction */
  keysMapping?: KeysMapping;
  /** Skip items with duplicate content (default: true) */
  deduplicate?: boolean;
}

/**
 * Column mapping for CSV import operations
 */
export interface CSVColumnMapping {
  /** Column name to use for input field (required) */
  inputColumn: string;
  /** Column name to use for expected field (optional) */
  expectedColumn?: string;
  /** Column names to include as metadata (optional) */
  metadataColumns?: string[];
}

/**
 * Options for CSV import operations
 */
export interface CSVImportOptions {
  /** Whether the CSV has a header row (default: true) */
  hasHeader?: boolean;
  /** Skip items with duplicate content (default: true) */
  deduplicate?: boolean;
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
 * Options for updating a dataset
 */
export interface UpdateDatasetOptions {
  /** New name for the dataset */
  name?: string;
  /** New description for the dataset */
  description?: string;
  /** New metadata for the dataset */
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

// ===========================================================================
// Dataset Versioning Types
// ===========================================================================

/**
 * A dataset version (snapshot of items at a point in time)
 */
export interface DatasetVersion {
  /** Unique identifier for the version */
  id: string;
  /** ID of the parent dataset */
  dataset_id: string;
  /** Version number (auto-incremented) */
  version: number;
  /** Number of items in this version */
  item_count: number;
  /** Optional description for the version */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** User ID who created this version */
  created_by?: string;
  /** ISO timestamp when created */
  created_at: string;
}

/**
 * Dataset with version information
 */
export interface DatasetWithVersionInfo {
  /** Unique identifier for the dataset */
  id: string;
  /** Project ID the dataset belongs to */
  project_id: string;
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Currently pinned version ID (null if unpinned) */
  current_version_id?: string;
  /** Currently pinned version details */
  current_version?: DatasetVersion;
  /** Latest version details */
  latest_version?: DatasetVersion;
  /** ISO timestamp when created */
  created_at: string;
  /** ISO timestamp when last updated */
  updated_at: string;
}

/**
 * Options for creating a dataset version
 */
export interface CreateVersionOptions {
  /** Optional description for the version */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for pinning a dataset version
 */
export interface PinVersionOptions {
  /** Version ID to pin (null to unpin) */
  versionId?: string | null;
}
