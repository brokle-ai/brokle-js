/**
 * Brokle SDK Error Classes
 *
 * Enhanced error classes with actionable guidance for common issues.
 * Follows Langfuse naming pattern (no prefix on specific errors).
 */

export interface BrokleErrorDetails {
  statusCode?: number;
  response?: Record<string, unknown>;
  retryAfter?: number;
  resourceType?: string;
  identifier?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

/**
 * Base error for all Brokle SDK errors.
 *
 * Includes actionable guidance to help users resolve issues.
 */
export class BrokleError extends Error {
  readonly hint?: string;
  readonly details: BrokleErrorDetails;
  readonly originalError?: Error;

  constructor(
    message: string,
    options?: {
      hint?: string;
      details?: BrokleErrorDetails;
      originalError?: Error;
    }
  ) {
    const fullMessage = options?.hint ? `${message}\n\nTo fix:\n${options.hint}` : message;
    super(fullMessage);

    this.name = 'BrokleError';
    this.hint = options?.hint;
    this.details = options?.details ?? {};
    this.originalError = options?.originalError;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Authentication failed.
 *
 * Raised when API key is invalid, missing, or expired.
 */
export class AuthenticationError extends BrokleError {
  constructor(message: string, options?: { hint?: string; details?: BrokleErrorDetails }) {
    super(message, options);
    this.name = 'AuthenticationError';
  }

  /**
   * Create authentication error from HTTP response.
   */
  static fromResponse(
    statusCode: number,
    responseBody?: Record<string, unknown>,
    apiKeyPrefix?: string
  ): AuthenticationError {
    const errorMsg =
      (responseBody?.error as Record<string, unknown>)?.message ?? 'Unknown authentication error';
    const keyInfo = apiKeyPrefix ? ` (key prefix: ${apiKeyPrefix}...)` : '';

    const hint = `1. Check your API key is set:
   export BROKLE_API_KEY=bk_your_secret_key

2. Verify the key is valid (should start with 'bk_'):
   console.log(process.env.BROKLE_API_KEY?.slice(0, 10) ?? 'NOT SET')

3. Test connection:
   import { getClient } from 'brokle';
   const client = getClient();
   console.log(await client.healthCheck() ? 'OK' : 'FAILED');

4. If using a custom base URL, verify it's correct:
   export BROKLE_BASE_URL=https://your-brokle-server.com`;

    return new AuthenticationError(
      `Authentication failed (HTTP ${statusCode})${keyInfo}: ${errorMsg}`,
      {
        hint,
        details: { statusCode, response: responseBody },
      }
    );
  }
}

/**
 * Connection to Brokle server failed.
 *
 * Raised when the server is unreachable or connection times out.
 */
export class ConnectionError extends BrokleError {
  constructor(
    message: string,
    options?: { hint?: string; details?: BrokleErrorDetails; originalError?: Error }
  ) {
    super(message, options);
    this.name = 'ConnectionError';
  }

  /**
   * Create connection error from underlying exception.
   */
  static fromError(originalError: Error, baseUrl?: string): ConnectionError {
    const urlInfo = baseUrl ? ` (${baseUrl})` : '';
    const hostname = baseUrl?.replace(/https?:\/\//, '').split(':')[0] ?? 'localhost';

    const hint = `1. Check if the Brokle server is running${urlInfo}:
   curl -s ${baseUrl ?? 'http://localhost:8080'}/health || echo "Server not reachable"

2. Verify your base URL is correct:
   export BROKLE_BASE_URL=http://localhost:8080  # Local development
   export BROKLE_BASE_URL=https://api.brokle.com  # Production

3. Check network connectivity:
   ping ${hostname}

4. If using Docker, ensure the container is running:
   docker ps | grep brokle`;

    return new ConnectionError(
      `Failed to connect to Brokle server${urlInfo}: ${originalError.message}`,
      {
        hint,
        details: { baseUrl },
        originalError,
      }
    );
  }
}

/**
 * Request validation failed.
 *
 * Raised when the request contains invalid data.
 */
export class ValidationError extends BrokleError {
  constructor(message: string, options?: { hint?: string; details?: BrokleErrorDetails }) {
    super(message, options);
    this.name = 'ValidationError';
  }

  /**
   * Create validation error from API response.
   */
  static fromResponse(responseBody: Record<string, unknown>, field?: string): ValidationError {
    const errorMsg =
      (responseBody?.error as Record<string, unknown>)?.message ?? 'Validation failed';
    const fieldInfo = field ? ` (field: ${field})` : '';

    const hint = `1. Check required fields are provided
2. Verify data types match expected format
3. Check string lengths and numeric ranges
4. Review API documentation for valid values`;

    return new ValidationError(`Validation error${fieldInfo}: ${errorMsg}`, {
      hint,
      details: { response: responseBody, field },
    });
  }
}

/**
 * Rate limit exceeded.
 *
 * Raised when too many requests are sent in a short period.
 */
export class RateLimitError extends BrokleError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    options?: { hint?: string; details?: BrokleErrorDetails; retryAfter?: number }
  ) {
    super(message, options);
    this.name = 'RateLimitError';
    this.retryAfter = options?.retryAfter;
  }

  /**
   * Create rate limit error from response.
   */
  static fromResponse(
    responseBody?: Record<string, unknown>,
    retryAfter?: number
  ): RateLimitError {
    const waitInfo = retryAfter ? ` (retry after ${retryAfter}s)` : '';

    const hint = `1. Wait before retrying${waitInfo || ' (check Retry-After header)'}
2. Reduce request frequency
3. Implement exponential backoff
4. Consider batching operations
5. Contact support for higher limits if needed`;

    return new RateLimitError(`Rate limit exceeded${waitInfo}`, {
      hint,
      details: { response: responseBody, retryAfter },
      retryAfter,
    });
  }
}

/**
 * Resource not found.
 *
 * Raised when the requested resource doesn't exist.
 */
export class NotFoundError extends BrokleError {
  constructor(message: string, options?: { hint?: string; details?: BrokleErrorDetails }) {
    super(message, options);
    this.name = 'NotFoundError';
  }

  /**
   * Create not found error for a specific resource.
   */
  static forResource(resourceType: string, identifier: string): NotFoundError {
    const hint = `1. Verify the ${resourceType} exists:
   - Check the dashboard for existing ${resourceType}s
   - Ensure correct project context

2. Check for typos in the identifier: '${identifier}'

3. If creating new, ensure the ${resourceType} was created successfully`;

    return new NotFoundError(
      `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found: '${identifier}'`,
      {
        hint,
        details: { resourceType, identifier },
      }
    );
  }
}

/**
 * Server-side error.
 *
 * Raised when the Brokle server encounters an internal error.
 */
export class ServerError extends BrokleError {
  constructor(message: string, options?: { hint?: string; details?: BrokleErrorDetails }) {
    super(message, options);
    this.name = 'ServerError';
  }

  /**
   * Create server error from response.
   */
  static fromResponse(statusCode: number, responseBody?: Record<string, unknown>): ServerError {
    const hint = `1. Retry the request after a brief delay
2. If persistent, check Brokle server status
3. Check server logs for more details
4. Contact support if the issue continues`;

    return new ServerError(`Server error (HTTP ${statusCode})`, {
      hint,
      details: { statusCode, response: responseBody },
    });
  }
}

/**
 * Raise appropriate error based on HTTP status code.
 */
export function raiseForStatus(
  statusCode: number,
  responseBody?: Record<string, unknown>,
  options?: {
    apiKeyPrefix?: string;
    baseUrl?: string;
    resourceType?: string;
    identifier?: string;
  }
): void {
  if (statusCode >= 200 && statusCode < 300) {
    return; // Success, no error
  }

  if (statusCode === 401 || statusCode === 403) {
    throw AuthenticationError.fromResponse(statusCode, responseBody, options?.apiKeyPrefix);
  }

  if (statusCode === 404) {
    if (options?.resourceType && options?.identifier) {
      throw NotFoundError.forResource(options.resourceType, options.identifier);
    }
    throw new NotFoundError('Resource not found', {
      hint: 'Check the resource identifier and project context.',
      details: { statusCode, response: responseBody },
    });
  }

  if (statusCode === 422) {
    throw ValidationError.fromResponse(responseBody ?? {});
  }

  if (statusCode === 429) {
    const retryAfter = responseBody?.retry_after as number | undefined;
    throw RateLimitError.fromResponse(responseBody, retryAfter);
  }

  if (statusCode >= 500) {
    throw ServerError.fromResponse(statusCode, responseBody);
  }

  // Generic error for other status codes
  const errorMsg =
    (responseBody?.error as Record<string, unknown>)?.message ?? 'Request failed';

  throw new BrokleError(`HTTP ${statusCode}: ${errorMsg}`, {
    details: { statusCode, response: responseBody },
  });
}
