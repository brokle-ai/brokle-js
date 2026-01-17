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
