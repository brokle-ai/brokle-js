/**
 * Brokle Scorers Module
 *
 * Provides built-in scorers, LLM-as-Judge scorers, and factory functions for
 * creating custom evaluation functions.
 *
 * Built-in Scorers:
 * - ExactMatch: Exact string comparison
 * - Contains: Substring matching
 * - RegexMatch: Regex pattern matching
 * - JSONValid: JSON validity check
 * - LengthCheck: String length validation
 *
 * LLM-as-Judge Scorers:
 * - LLMScorer: Use LLM models to evaluate outputs with project credentials
 *
 * Factory Functions:
 * - scorer(): Create custom scorers from functions
 * - multiScorer(): Create scorers that return multiple scores
 *
 * @example
 * ```typescript
 * import { ExactMatch, Contains, LLMScorer, scorer } from 'brokle/scorers';
 *
 * // Built-in scorer
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 *
 * // LLM-as-Judge scorer
 * const relevance = LLMScorer({
 *   name: 'relevance',
 *   prompt: 'Rate relevance 0-10: {{output}}',
 *   model: 'gpt-4o',
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

// LLM-as-Judge scorers
export { LLMScorer } from './llm-scorer';
export type { LLMScorerOptions, LLMScorerClientConfig } from './llm-scorer';
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
export type { ScoreResult, ScoreValue, Scorer, ScorerArgs } from '../scores/types';
export { ScoreType } from '../scores/types';
