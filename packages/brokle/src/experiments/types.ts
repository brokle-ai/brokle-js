/**
 * Experiments Type Definitions
 *
 * Core types for the experiment and evaluation system.
 */

import type { ScoreResult, Scorer } from '../scores/types';
import type { Dataset } from '../datasets';

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
  /** ID of the dataset item evaluated */
  datasetItemId: string;
  /** Input data passed to task */
  input: Record<string, unknown>;
  /** Output from the task function */
  output: unknown;
  /** Expected output for comparison */
  expected?: unknown;
  /** Scores from all scorers */
  scores: ScoreResult[];
  /** Trial number (when trial_count > 1) */
  trialNumber: number;
  /** Error message if task failed */
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
  /** Dataset ID used */
  datasetId: string;
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
 */
export interface RunOptions {
  /** Experiment name */
  name: string;
  /** Dataset or dataset ID */
  dataset: Dataset | string;
  /** Task function to evaluate */
  task: TaskFunction;
  /** Scorers to apply */
  scorers: Scorer[];
  /** Maximum concurrent evaluations (default: 10) */
  maxConcurrency?: number;
  /** Number of trials per item for variance measurement (default: 1) */
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
