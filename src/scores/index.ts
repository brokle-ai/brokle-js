/**
 * Scores Module
 *
 * Manager for submitting quality scores to traces and spans.
 * Follows Stripe/OpenAI namespace pattern: client.scores.submit()
 *
 * @example
 * ```typescript
 * import { getClient, ScoreType } from 'brokle';
 * import { ExactMatch } from 'brokle/scorers';
 *
 * const client = getClient();
 *
 * // Direct score submission
 * await client.scores.submit({
 *   traceId: "abc123",
 *   name: "quality",
 *   value: 0.9,
 *   type: ScoreType.NUMERIC,
 * });
 *
 * // Using a scorer function
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 *
 * // Batch submission
 * await client.scores.batch([
 *   { traceId: "abc", name: "quality", value: 0.9 },
 *   { traceId: "def", name: "quality", value: 0.8 },
 * ]);
 * ```
 *
 * @packageDocumentation
 */

export { ScoresManager } from './manager';
export type { ScoresManagerConfig } from './types';

export { ScoreType, ScoreSource } from './types';
export type {
  ScoreResult,
  ScoreValue,
  Scorer,
  ScorerArgs,
  SubmitScoreOptions,
  BatchScoreOptions,
  ScoreRequest,
  ScoreResponse,
  BatchScoreResult,
  APIResponse,
} from './types';

export { ScoreError, ScorerError } from './errors';
