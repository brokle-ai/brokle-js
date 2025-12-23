/**
 * Evaluations Module
 *
 * Manager for running evaluations and submitting quality scores.
 *
 * @example
 * ```typescript
 * import { getClient, ScoreType } from 'brokle';
 * import { ExactMatch } from 'brokle/scorers';
 *
 * const client = getClient();
 *
 * // Direct score submission
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   name: "quality",
 *   value: 0.9,
 *   type: ScoreType.NUMERIC,
 * });
 *
 * // Using a scorer function
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 * ```
 *
 * @packageDocumentation
 */

// Manager
export { EvaluationsManager } from './manager';
export type { EvaluationsManagerConfig } from './manager';

// Types
export { ScoreType, ScoreSource } from './types';
export type {
  ScoreResult,
  ScoreValue,
  Scorer,
  ScorerArgs,
  ScoreOptions,
  BatchScoreOptions,
  ScoreRequest,
  ScoreResponse,
} from './types';

// Errors
export { EvaluationError, ScoreError, ScorerError } from './errors';
