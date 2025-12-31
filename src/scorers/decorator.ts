/**
 * Scorer Factory Functions
 *
 * Factory functions for creating custom scorers from functions.
 *
 * @example
 * ```typescript
 * import { scorer, multiScorer } from 'brokle/scorers';
 *
 * // Simple scorer returning number
 * const similarity = scorer("similarity", ({ output, expected }) => {
 *   return computeSimilarity(output, expected); // returns 0.85
 * });
 *
 * // Multi-scorer returning multiple scores
 * const qualityMetrics = multiScorer("quality", ({ output }) => [
 *   { name: "accuracy", value: 0.9 },
 *   { name: "fluency", value: 0.85 },
 * ]);
 * ```
 */

import type { ScoreResult, ScoreValue, Scorer, ScorerArgs } from '../scores/types';
import { ScoreType } from '../scores/types';

/**
 * Scorer function type that can return various types
 */
export type ScorerFunction = (args: ScorerArgs) => ScoreValue | Promise<ScoreValue>;

/**
 * Multi-scorer function type that returns multiple ScoreResults
 */
export type MultiScorerFunction = (args: ScorerArgs) => ScoreResult[] | Promise<ScoreResult[]>;

/**
 * Create a scorer from a function.
 *
 * The function can return:
 * - number: Auto-wrapped in ScoreResult with given name
 * - boolean: Converted to 1/0 with BOOLEAN type
 * - ScoreResult: Used directly
 * - ScoreResult[]: Multiple scores from one evaluation
 * - null: Skip scoring
 *
 * @param name - Scorer name for identification
 * @param fn - Scorer function
 * @returns Scorer function ready for use with evaluations
 *
 * @example
 * ```typescript
 * // Return number (auto-wrapped)
 * const similarity = scorer("similarity", ({ output, expected }) => {
 *   return computeSimilarity(output, expected);
 * });
 *
 * // Return boolean
 * const isCorrect = scorer("is_correct", ({ output, expected }) => {
 *   return output === expected;
 * });
 *
 * // Return full ScoreResult
 * const detailed = scorer("detailed", ({ output, expected }) => ({
 *   name: "detailed",
 *   value: 0.9,
 *   reason: "High similarity",
 *   metadata: { algorithm: "cosine" },
 * }));
 *
 * // Usage
 * await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: similarity,
 *   output: "result",
 *   expected: "expected",
 * });
 * ```
 */
export function scorer(name: string, fn: ScorerFunction): Scorer {
  const wrappedFn = async (args: ScorerArgs): Promise<ScoreValue> => {
    const result = await fn(args);

    if (result === null || Array.isArray(result)) {
      return result;
    }

    if (typeof result === 'object' && 'name' in result && 'value' in result) {
      return result as ScoreResult;
    }

    if (typeof result === 'boolean') {
      return {
        name,
        value: result ? 1 : 0,
        type: ScoreType.BOOLEAN,
      };
    }

    if (typeof result === 'number') {
      return {
        name,
        value: result,
        type: ScoreType.NUMERIC,
      };
    }

    throw new TypeError(
      `Scorer '${name}' must return ScoreResult, ScoreResult[], number, boolean, or null, ` +
        `got ${typeof result}`
    );
  };

  Object.defineProperty(wrappedFn, 'name', { value: name, writable: false });

  return wrappedFn as Scorer;
}

/**
 * Create a scorer that returns multiple scores.
 *
 * Use this when a single evaluation produces multiple scores
 * (e.g., accuracy, fluency, and relevance from one function).
 *
 * @param name - Scorer name for identification (used for error messages)
 * @param fn - Function returning ScoreResult[]
 * @returns Scorer function ready for use with evaluations
 *
 * @example
 * ```typescript
 * const qualityMetrics = multiScorer("quality_metrics", ({ output, expected }) => {
 *   const accuracy = computeAccuracy(output, expected);
 *   const fluency = computeFluency(output);
 *   const relevance = computeRelevance(output, expected);
 *
 *   return [
 *     { name: "accuracy", value: accuracy },
 *     { name: "fluency", value: fluency },
 *     { name: "relevance", value: relevance },
 *   ];
 * });
 *
 * // Returns array of responses
 * const results = await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: qualityMetrics,
 *   output: "The answer is 42",
 *   expected: "42",
 * });
 * ```
 */
export function multiScorer(name: string, fn: MultiScorerFunction): Scorer {
  const wrappedFn = async (args: ScorerArgs): Promise<ScoreResult[]> => {
    const result = await fn(args);

    if (!Array.isArray(result)) {
      throw new TypeError(`Multi-scorer '${name}' must return ScoreResult[], got ${typeof result}`);
    }

    for (const item of result) {
      if (typeof item !== 'object' || !('name' in item) || !('value' in item)) {
        throw new TypeError(
          `Multi-scorer '${name}' must return ScoreResult[], but array contains invalid item`
        );
      }
    }

    return result;
  };

  Object.defineProperty(wrappedFn, 'name', { value: name, writable: false });

  return wrappedFn as Scorer;
}
