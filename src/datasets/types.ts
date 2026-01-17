export interface DatasetItemInput {
  input: Record<string, unknown>;
  expected?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DatasetItem {
  id: string;
  dataset_id: string;
  input: Record<string, unknown>;
  expected?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Item source (manual, trace, span, csv, json, sdk) */
  source: DatasetItemSource;
  source_trace_id?: string;
  source_span_id?: string;
  created_at: string;
}

export type DatasetItemSource = 'manual' | 'trace' | 'span' | 'csv' | 'json' | 'sdk';

export interface KeysMapping {
  inputKeys?: string[];
  expectedKeys?: string[];
  metadataKeys?: string[];
}

export interface BulkImportResult {
  created: number;
  /** Number of items skipped (duplicates) */
  skipped: number;
  errors?: string[];
}

export interface ImportOptions {
  keysMapping?: KeysMapping;
  /** Skip items with duplicate content (default: true) */
  deduplicate?: boolean;
}

export interface CSVColumnMapping {
  /** Column name to use for input field (required) */
  inputColumn: string;
  /** Column name to use for expected field (optional) */
  expectedColumn?: string;
  /** Column names to include as metadata (optional) */
  metadataColumns?: string[];
}

export interface CSVImportOptions {
  /** Whether the CSV has a header row (default: true) */
  hasHeader?: boolean;
  /** Skip items with duplicate content (default: true) */
  deduplicate?: boolean;
}

export interface DatasetData {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateDatasetOptions {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDatasetOptions {
  /** New name for the dataset */
  name?: string;
  /** New description for the dataset */
  description?: string;
  /** New metadata for the dataset */
  metadata?: Record<string, unknown>;
}

export interface GetItemsOptions {
  /** Maximum items to return (default: 50, valid: 10, 25, 50, 100) */
  limit?: number;
  /** Page number (default: 1, 1-indexed) */
  page?: number;
}

export interface ListDatasetsOptions {
  /** Maximum datasets to return (default: 50, valid: 10, 25, 50, 100) */
  limit?: number;
  /** Page number (default: 1, 1-indexed) */
  page?: number;
}

export interface DatasetConfig {
  baseUrl: string;
  apiKey: string;
  debug?: boolean;
}

export interface DatasetsManagerConfig {
  baseUrl: string;
  apiKey: string;
  debug?: boolean;
}

export interface APIPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface APIMeta {
  request_id?: string;
  timestamp?: string;
  version?: string;
  pagination?: APIPagination;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
  meta?: APIMeta;
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
