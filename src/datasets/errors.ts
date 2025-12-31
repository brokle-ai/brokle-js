/**
 * Dataset Error Classes
 *
 * Error hierarchy for dataset operations.
 */

/**
 * Base error for dataset operations
 */
export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatasetError);
    }
  }
}
