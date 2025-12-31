/**
 * Scores Type Definitions
 *
 * Core types for the scoring and evaluation system.
 */

/**
 * Score type classification
 */
export enum ScoreType {
  NUMERIC = 'NUMERIC',
  CATEGORICAL = 'CATEGORICAL',
  BOOLEAN = 'BOOLEAN',
}

/**
 * Score source - who/what created the score
 */
export enum ScoreSource {
  CODE = 'code',
  LLM = 'llm',
  HUMAN = 'human',
}

/**
 * Result from a scorer function
 */
export interface ScoreResult {
  /** Score name */
  name: string;
  /** Score value (numeric) */
  value: number;
  /** Score type classification */
  type?: ScoreType;
  /** String value for CATEGORICAL scores */
  stringValue?: string;
  /** Reason/explanation for the score */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Flag indicating scorer execution failed */
  scoringFailed?: boolean;
}

/**
 * Flexible scorer return types.
 * Scorers can return various types which are normalized to ScoreResult.
 */
export type ScoreValue = number | boolean | ScoreResult | ScoreResult[] | null;

/**
 * Arguments passed to scorer functions
 */
export interface ScorerArgs {
  /** The actual output to evaluate */
  output: unknown;
  /** The expected/reference value (optional) */
  expected?: unknown;
  /** Additional arguments for custom scorers */
  [key: string]: unknown;
}

/**
 * Scorer function interface
 */
export interface Scorer {
  /** Scorer name for identification */
  name: string;
  /** Scorer function */
  (args: ScorerArgs): ScoreValue | Promise<ScoreValue>;
}

/**
 * Options for the submit() method
 */
export interface SubmitScoreOptions {
  /** Trace ID to associate the score with */
  traceId: string;
  /** Optional span ID for span-level scores */
  spanId?: string;
  /** Scorer function to execute */
  scorer?: Scorer;
  /** Output to evaluate (when using scorer) */
  output?: unknown;
  /** Expected value (when using scorer) */
  expected?: unknown;
  /** Score name (when not using scorer) */
  name?: string;
  /** Score value (when not using scorer) */
  value?: number;
  /** Score type */
  type?: ScoreType;
  /** Score source */
  source?: ScoreSource;
  /** Reason/explanation */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for batch score submission
 */
export interface BatchScoreOptions {
  /** Trace ID to associate the score with */
  traceId: string;
  /** Optional span ID for span-level scores */
  spanId?: string;
  /** Score name */
  name: string;
  /** Score value */
  value: number;
  /** Score type */
  type?: ScoreType;
  /** Score source */
  source?: ScoreSource;
  /** Reason/explanation */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * API request payload for score submission
 */
export interface ScoreRequest {
  trace_id: string;
  name: string;
  value: number;
  type: string;
  source: string;
  span_id?: string;
  string_value?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * API response for score submission
 */
export interface ScoreResponse {
  id: string;
  trace_id: string;
  name: string;
  value: number;
  type: string;
  source: string;
  created_at: string;
}

/**
 * Configuration for the scores manager
 */
export interface ScoresManagerConfig {
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
