/**
 * Evaluation Error Classes
 *
 * Hierarchical error system for evaluation operations.
 */

/**
 * Base evaluation error
 */
export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EvaluationError);
    }
  }
}

/**
 * Error submitting score to API
 */
export class ScoreError extends EvaluationError {
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
export class ScorerError extends EvaluationError {
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
