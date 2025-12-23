/**
 * Built-in Scorers
 *
 * Ready-to-use scorers for common evaluation patterns.
 *
 * @example
 * ```typescript
 * import { ExactMatch, Contains, JSONValid } from 'brokle/scorers';
 *
 * const exact = ExactMatch({ name: "answer_match", caseSensitive: false });
 * const contains = Contains({ name: "has_keyword" });
 * const jsonCheck = JSONValid();
 *
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "paris",
 * });
 * ```
 */

import type { ScoreResult, Scorer, ScorerArgs } from '../evaluations/types';
import { ScoreType } from '../evaluations/types';

/**
 * Options for ExactMatch scorer
 */
export interface ExactMatchOptions {
  /** Score name (default: "exact_match") */
  name?: string;
  /** Whether to perform case-sensitive comparison (default: true) */
  caseSensitive?: boolean;
}

/**
 * Exact string comparison scorer.
 *
 * Compares output and expected values as strings after trimming whitespace.
 *
 * @param options - Configuration options
 * @returns Scorer function
 *
 * @example
 * ```typescript
 * const exact = ExactMatch({ name: "answer_match", caseSensitive: false });
 * // Returns 1.0 for "Paris" vs "paris", 0.0 for "London" vs "paris"
 * ```
 */
export function ExactMatch(options: ExactMatchOptions = {}): Scorer {
  const { name = 'exact_match', caseSensitive = true } = options;

  const fn = ({ output, expected }: ScorerArgs): ScoreResult => {
    let outStr = String(output ?? '').trim();
    let expStr = String(expected ?? '').trim();

    if (!caseSensitive) {
      outStr = outStr.toLowerCase();
      expStr = expStr.toLowerCase();
    }

    const match = outStr === expStr;

    return {
      name,
      value: match ? 1 : 0,
      type: ScoreType.BOOLEAN,
    };
  };

  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}

/**
 * Options for Contains scorer
 */
export interface ContainsOptions {
  /** Score name (default: "contains") */
  name?: string;
  /** Whether to perform case-sensitive comparison (default: true) */
  caseSensitive?: boolean;
}

/**
 * Substring matching scorer.
 *
 * Checks if the expected value is contained within the output.
 *
 * @param options - Configuration options
 * @returns Scorer function
 *
 * @example
 * ```typescript
 * const contains = Contains({ name: "has_keyword" });
 * // Returns 1.0 for "The capital is Paris" containing "Paris"
 * ```
 */
export function Contains(options: ContainsOptions = {}): Scorer {
  const { name = 'contains', caseSensitive = true } = options;

  const fn = ({ output, expected }: ScorerArgs): ScoreResult => {
    let outStr = String(output ?? '');
    let expStr = String(expected ?? '');

    if (!caseSensitive) {
      outStr = outStr.toLowerCase();
      expStr = expStr.toLowerCase();
    }

    const match = outStr.includes(expStr);

    return {
      name,
      value: match ? 1 : 0,
      type: ScoreType.BOOLEAN,
    };
  };

  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}

/**
 * Options for RegexMatch scorer
 */
export interface RegexMatchOptions {
  /** Regex pattern (string or RegExp) */
  pattern: string | RegExp;
  /** Score name (default: "regex_match") */
  name?: string;
}

/**
 * Regex pattern matching scorer.
 *
 * Checks if the output matches a given regex pattern.
 *
 * @param options - Configuration options (pattern is required)
 * @returns Scorer function
 *
 * @example
 * ```typescript
 * // Match email pattern
 * const emailCheck = RegexMatch({
 *   pattern: /[a-z]+@[a-z]+\.[a-z]+/i,
 *   name: "has_email"
 * });
 *
 * // Match phone pattern
 * const phoneCheck = RegexMatch({ pattern: /\d{3}-\d{3}-\d{4}/ });
 * ```
 */
export function RegexMatch(options: RegexMatchOptions): Scorer {
  const { pattern, name = 'regex_match' } = options;
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

  const fn = ({ output }: ScorerArgs): ScoreResult => {
    const match = regex.test(String(output ?? ''));

    return {
      name,
      value: match ? 1 : 0,
      type: ScoreType.BOOLEAN,
    };
  };

  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}

/**
 * Options for JSONValid scorer
 */
export interface JSONValidOptions {
  /** Score name (default: "json_valid") */
  name?: string;
}

/**
 * JSON validity check scorer.
 *
 * Validates whether the output is valid JSON.
 *
 * @param options - Configuration options
 * @returns Scorer function
 *
 * @example
 * ```typescript
 * const jsonCheck = JSONValid();
 * // Returns 1.0 for '{"key": "value"}', 0.0 for '{invalid json}'
 * ```
 */
export function JSONValid(options: JSONValidOptions = {}): Scorer {
  const { name = 'json_valid' } = options;

  const fn = ({ output }: ScorerArgs): ScoreResult => {
    let valid = false;
    try {
      JSON.parse(String(output ?? ''));
      valid = true;
    } catch {
      valid = false;
    }

    return {
      name,
      value: valid ? 1 : 0,
      type: ScoreType.BOOLEAN,
    };
  };

  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}

/**
 * Options for LengthCheck scorer
 */
export interface LengthCheckOptions {
  /** Minimum allowed length (inclusive) */
  minLength?: number;
  /** Maximum allowed length (inclusive) */
  maxLength?: number;
  /** Score name (default: "length_check") */
  name?: string;
}

/**
 * String length validation scorer.
 *
 * Validates that the output length falls within specified bounds.
 *
 * @param options - Configuration options (at least one of minLength or maxLength recommended)
 * @returns Scorer function
 *
 * @example
 * ```typescript
 * // Check for reasonable response length
 * const length = LengthCheck({ minLength: 10, maxLength: 1000 });
 *
 * // Ensure minimum length
 * const minCheck = LengthCheck({ minLength: 50 });
 * ```
 */
export function LengthCheck(options: LengthCheckOptions = {}): Scorer {
  const { minLength, maxLength, name = 'length_check' } = options;

  const fn = ({ output }: ScorerArgs): ScoreResult => {
    const length = String(output ?? '').length;
    let valid = true;

    if (minLength !== undefined && length < minLength) {
      valid = false;
    }
    if (maxLength !== undefined && length > maxLength) {
      valid = false;
    }

    return {
      name,
      value: valid ? 1 : 0,
      type: ScoreType.BOOLEAN,
      metadata: { length },
    };
  };

  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}
