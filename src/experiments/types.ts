import type { ScoreResult, Scorer } from '../scores/types';
import type { Dataset } from '../datasets';
import type { QueriedSpan } from '../query';

export type SpanExtractInput = (span: QueriedSpan) => Record<string, unknown>;
export type SpanExtractOutput = (span: QueriedSpan) => unknown;
export type SpanExtractExpected = (span: QueriedSpan) => unknown;

export interface Experiment {
  id: string;
  name: string;
  datasetId: string;
  status: 'running' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationItem {
  datasetItemId?: string;
  spanId?: string;
  input: Record<string, unknown>;
  output: unknown;
  expected?: unknown;
  scores: ScoreResult[];
  trialNumber: number;
  error?: string;
}

export interface SummaryStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
  passRate: number;
}

export interface EvaluationResults {
  experimentId: string;
  experimentName: string;
  datasetId?: string;
  source: 'dataset' | 'spans';
  url?: string;
  summary: Record<string, SummaryStats>;
  items: EvaluationItem[];
}

export type TaskFunction = (input: Record<string, unknown>) => Promise<unknown> | unknown;
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * Options for running an experiment
 *
 * You can run evaluations in two modes:
 *
 * **Dataset-based** (traditional):
 * - Provide `dataset` and `task`
 * - Task function is called for each dataset item
 * - Scorers evaluate task outputs
 *
 * **Span-based** (THE WEDGE):
 * - Provide `spans`, `extractInput`, and `extractOutput`
 * - No task execution - spans already contain outputs
 * - Scorers evaluate extracted data from production spans
 */
export interface RunOptions {
  /** Experiment name */
  name: string;

  // === Dataset-based evaluation ===
  /** Dataset or dataset ID (required for dataset-based, mutually exclusive with spans) */
  dataset?: Dataset | string;
  /** Task function to evaluate (required for dataset-based) */
  task?: TaskFunction;

  // === Span-based evaluation (THE WEDGE) ===
  /** Queried spans to evaluate (required for span-based, mutually exclusive with dataset) */
  spans?: QueriedSpan[];
  /** Function to extract input from span (required when using spans) */
  extractInput?: SpanExtractInput;
  /** Function to extract output from span (required when using spans) */
  extractOutput?: SpanExtractOutput;
  /** Function to extract expected output from span (optional) */
  extractExpected?: SpanExtractExpected;

  // === Common options ===
  /** Scorers to apply */
  scorers: Scorer[];
  /** Maximum concurrent evaluations (default: 10) */
  maxConcurrency?: number;
  /** Number of trials per item for variance measurement (default: 1, only for dataset-based) */
  trialCount?: number;
  /** Additional metadata for the experiment */
  metadata?: Record<string, unknown>;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

export interface ListExperimentsOptions {
  /** Maximum experiments to return (default: 50, valid: 10, 25, 50, 100) */
  limit?: number;
  /** Page number (default: 1, 1-indexed) */
  page?: number;
}

export interface ExperimentsManagerConfig {
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

export interface ExperimentData {
  id: string;
  name: string;
  dataset_id: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubmitItemData {
  dataset_item_id: string;
  input: Record<string, unknown>;
  output: unknown;
  expected?: unknown;
  scores: Array<{
    name: string;
    value: number;
    type?: string;
    string_value?: string;
    reason?: string;
    scoring_failed?: boolean;
    metadata?: Record<string, unknown>;
  }>;
  trial_number: number;
  error?: string;
}

// ===========================================================================
// Experiment Operations Types (rerun, compare)
// ===========================================================================

/**
 * Options for re-running an experiment
 */
export interface RerunExperimentOptions {
  /** New name (defaults to "{original}-rerun-{timestamp}") */
  name?: string;
  /** New description */
  description?: string;
  /** New metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for comparing experiments
 */
export interface CompareExperimentsOptions {
  /** Baseline experiment ID for diff calculations */
  baselineId?: string;
}

/**
 * Score aggregation statistics from experiment comparison
 */
export interface ScoreAggregation {
  /** Average score value */
  mean: number;
  /** Standard deviation of scores */
  stdDev: number;
  /** Minimum score value */
  min: number;
  /** Maximum score value */
  max: number;
  /** Total number of scores */
  count: number;
}

/**
 * Score difference from baseline in experiment comparison
 */
export interface ScoreDiff {
  /** Diff type (e.g., "percentage", "absolute") */
  type?: string;
  /** Numeric difference value */
  difference: number;
  /** Direction of change ("up", "down", "same") */
  direction: string;
}

/**
 * Experiment summary in comparison results
 */
export interface ExperimentSummary {
  /** Experiment name */
  name: string;
  /** Experiment status */
  status: string;
}

/**
 * Result of comparing multiple experiments
 */
export interface ComparisonResult {
  /** Map of experiment ID to summary info */
  experiments: Record<string, ExperimentSummary>;
  /** Map of scorer name -> experiment ID -> aggregation stats */
  scores: Record<string, Record<string, ScoreAggregation>>;
  /** Map of scorer name -> experiment ID -> diff from baseline (optional) */
  diffs?: Record<string, Record<string, ScoreDiff>>;
}

/**
 * API response data for comparison
 */
export interface ComparisonResultData {
  experiments: Record<string, ExperimentSummary>;
  scores: Record<string, Record<string, ScoreAggregation>>;
  diffs?: Record<string, Record<string, ScoreDiff>>;
}
