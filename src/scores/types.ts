export enum ScoreType {
  NUMERIC = 'NUMERIC',
  CATEGORICAL = 'CATEGORICAL',
  BOOLEAN = 'BOOLEAN',
}

export enum ScoreSource {
  CODE = 'code',
  LLM = 'llm',
  HUMAN = 'human',
}

export interface ScoreResult {
  name: string;
  value: number;
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

/** Scorers can return various types which are normalized to ScoreResult */
export type ScoreValue = number | boolean | ScoreResult | ScoreResult[] | null;

export interface ScorerArgs {
  output: unknown;
  expected?: unknown;
  [key: string]: unknown;
}

export interface Scorer {
  name: string;
  (args: ScorerArgs): ScoreValue | Promise<ScoreValue>;
}

export interface SubmitScoreOptions {
  traceId: string;
  spanId?: string;
  /** Scorer function to execute (scorer mode) */
  scorer?: Scorer;
  /** Output to evaluate (scorer mode) */
  output?: unknown;
  /** Expected value (scorer mode) */
  expected?: unknown;
  /** Score name (direct mode) */
  name?: string;
  /** Score value (direct mode) */
  value?: number;
  type?: ScoreType;
  source?: ScoreSource;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchScoreOptions {
  traceId: string;
  spanId?: string;
  name: string;
  value: number;
  type?: ScoreType;
  source?: ScoreSource;
  reason?: string;
  metadata?: Record<string, unknown>;
}

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

export interface ScoreResponse {
  id: string;
  trace_id: string;
  name: string;
  value: number;
  type: string;
  source: string;
  created_at: string;
}

export interface BatchScoreResult {
  created: number;
}

export interface ScoresManagerConfig {
  baseUrl: string;
  apiKey: string;
  debug?: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}
