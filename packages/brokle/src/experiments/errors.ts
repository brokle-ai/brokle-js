/**
 * Experiment Error Classes
 *
 * Error hierarchy for experiment and evaluation operations.
 */

/**
 * Base error for experiment operations
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
 * Error when task function fails
 */
export class TaskError extends EvaluationError {
  /** Dataset item ID where the error occurred */
  datasetItemId?: string;
  /** Original error that caused the failure */
  originalError?: Error;

  constructor(message: string, datasetItemId?: string, originalError?: Error) {
    super(message);
    this.name = 'TaskError';
    this.datasetItemId = datasetItemId;
    this.originalError = originalError;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TaskError);
    }
  }
}

/**
 * Error when scorer execution fails
 */
export class ScorerExecutionError extends EvaluationError {
  /** Name of the scorer that failed */
  scorerName?: string;
  /** Dataset item ID where the error occurred */
  datasetItemId?: string;
  /** Original error that caused the failure */
  originalError?: Error;

  constructor(
    message: string,
    scorerName?: string,
    datasetItemId?: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ScorerExecutionError';
    this.scorerName = scorerName;
    this.datasetItemId = datasetItemId;
    this.originalError = originalError;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScorerExecutionError);
    }
  }
}
