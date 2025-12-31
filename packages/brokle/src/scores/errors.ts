/**
 * Score Error Classes
 *
 * Error hierarchy for score operations.
 */

/**
 * Base error for score operations
 */
export class ScoreError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ScoreError';
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScoreError);
    }
  }
}

/**
 * Error executing scorer function
 */
export class ScorerError extends Error {
  public readonly scorerName: string;
  public readonly cause?: Error;

  constructor(scorerName: string, message: string, cause?: Error) {
    super(`Scorer '${scorerName}' failed: ${message}`);
    this.name = 'ScorerError';
    this.scorerName = scorerName;
    this.cause = cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScorerError);
    }
  }
}
