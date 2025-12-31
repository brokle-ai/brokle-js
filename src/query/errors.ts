/**
 * Query Module Errors
 *
 * Error classes for query-related operations.
 */

/**
 * Base error for query operations
 */
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryError';
    Object.setPrototypeOf(this, QueryError.prototype);
  }
}

/**
 * Error thrown when filter syntax is invalid
 */
export class InvalidFilterError extends QueryError {
  /** The invalid filter expression */
  readonly filter: string;
  /** Validation error details */
  readonly details?: string;

  constructor(filter: string, details?: string) {
    const message = details
      ? `Invalid filter syntax: ${details}`
      : `Invalid filter syntax: ${filter}`;
    super(message);
    this.name = 'InvalidFilterError';
    this.filter = filter;
    this.details = details;
    Object.setPrototypeOf(this, InvalidFilterError.prototype);
  }
}

/**
 * Error thrown when query API request fails
 */
export class QueryAPIError extends QueryError {
  /** HTTP status code */
  readonly statusCode?: number;
  /** API error code */
  readonly code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'QueryAPIError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, QueryAPIError.prototype);
  }
}
