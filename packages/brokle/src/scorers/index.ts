/**
 * Brokle Scorers Module
 *
 * Provides built-in scorers and factory functions for creating custom evaluation functions.
 *
 * Built-in Scorers:
 * - ExactMatch: Exact string comparison
 * - Contains: Substring matching
 * - RegexMatch: Regex pattern matching
 * - JSONValid: JSON validity check
 * - LengthCheck: String length validation
 *
 * Factory Functions:
 * - scorer(): Create custom scorers from functions
 * - multiScorer(): Create scorers that return multiple scores
 *
 * @example
 * ```typescript
 * import { ExactMatch, Contains, scorer } from 'brokle/scorers';
 *
 * // Built-in scorer
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 *
 * // Custom scorer
 * const similarity = scorer("similarity", ({ output, expected }) => {
 *   return computeSimilarity(output, expected);
 * });
 * ```
 *
 * @packageDocumentation
 */

// Built-in scorers
export { ExactMatch, Contains, RegexMatch, JSONValid, LengthCheck } from './base';
export type {
  ExactMatchOptions,
  ContainsOptions,
  RegexMatchOptions,
  JSONValidOptions,
  LengthCheckOptions,
} from './base';

// Factory functions
export { scorer, multiScorer } from './decorator';
export type { ScorerFunction, MultiScorerFunction } from './decorator';

// Re-export types for convenience in custom scorers
export type { ScoreResult, ScoreValue, Scorer, ScorerArgs } from '../evaluations/types';
export { ScoreType } from '../evaluations/types';
