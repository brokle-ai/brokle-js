/**
 * Experiments Type Definitions
 *
 * Core types for the experiment and evaluation system.
 */

import type { ScoreResult, Scorer } from '../scores/types';
import type { Dataset } from '../datasets';
import type { QueriedSpan } from '../query';

/**
 * Function to extract input from a queried span
 */
export type SpanExtractInput = (span: QueriedSpan) => Record<string, unknown>;

/**
 * Function to extract output from a queried span
 */
export type SpanExtractOutput = (span: QueriedSpan) => unknown;

/**
 * Function to extract expected output from a queried span
 */
export type SpanExtractExpected = (span: QueriedSpan) => unknown;

/**
 * Experiment metadata (for list/get operations)
 */
export interface Experiment {
  /** Unique identifier for the experiment */
  id: string;
  /** Experiment name */
  name: string;
  /** ID of the dataset used */
  datasetId: string;
  /** Experiment status */
  status: 'running' | 'completed' | 'failed';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Single evaluation item result
 */
export interface EvaluationItem {
  /** ID of the dataset item evaluated (for dataset-based evaluation) */
  datasetItemId?: string;
  /** ID of the span evaluated (for span-based evaluation) */
  spanId?: string;
  /** Input data passed to task or extracted from span */
  input: Record<string, unknown>;
  /** Output from the task function or extracted from span */
  output: unknown;
  /** Expected output for comparison */
  expected?: unknown;
  /** Scores from all scorers */
  scores: ScoreResult[];
  /** Trial number (when trial_count > 1) */
  trialNumber: number;
  /** Error message if task/extraction failed */
  error?: string;
}

/**
 * Per-scorer summary statistics
 */
export interface SummaryStats {
  /** Mean score value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum score value */
  min: number;
  /** Maximum score value */
  max: number;
  /** Total number of scores */
  count: number;
  /** Percentage of non-failed scores */
  passRate: number;
}

/**
 * Complete evaluation results from run()
 */
export interface EvaluationResults {
  /** Experiment ID */
  experimentId: string;
  /** Experiment name */
  experimentName: string;
  /** Dataset ID used (for dataset-based evaluation) */
  datasetId?: string;
  /** Source type: 'dataset' or 'spans' */
  source: 'dataset' | 'spans';
  /** Dashboard URL for the experiment */
  url?: string;
  /** Per-scorer summary statistics */
  summary: Record<string, SummaryStats>;
  /** Individual evaluation items */
  items: EvaluationItem[];
}

/**
 * Task function type - processes input and returns output
 */
export type TaskFunction = (input: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Progress callback type
 */
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

/**
 * Options for listing experiments
 */
export interface ListExperimentsOptions {
  /** Maximum number of experiments to return (default: 50) */
  limit?: number;
  /** Number of experiments to skip (default: 0) */
  offset?: number;
}

/**
 * Configuration for the experiments manager
 */
export interface ExperimentsManagerConfig {
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

/**
 * Experiment API response data
 */
export interface ExperimentData {
  id: string;
  name: string;
  dataset_id: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Item to submit to the API
 */
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
