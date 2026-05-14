/**
 * Query Module Errors
 *
 * The query module exposes ONE axis-2 domain error:
 *
 *   InvalidFilterError  – the backend parser rejected a filter expression.
 *
 * It inherits from the shared-client `ValidationError` (422) so callers can
 * catch either `instanceof ValidationError` (the HTTP-family view) or
 * `instanceof InvalidFilterError` (the filter-syntax-specific view) and both
 * compose. Every other failure (auth, network, 5xx, rate limit, not found)
 * propagates as the shared `BrokleError` subclass the HTTP client raised —
 * see `sdk/javascript/src/errors.ts`.
 *
 * This follows Stripe/OpenAI/Anthropic/Azure/Google/Octokit/Twilio: one
 * shared error hierarchy per SDK; module-local types exist only for
 * semantics HTTP status cannot express, and they extend the shared family
 * rather than wrapping it.
 */

import { ValidationError } from '../errors';

/**
 * The backend filter parser rejected a filter expression.
 *
 * Thrown by `QueryManager.query()` on HTTP 422 responses from
 * `/v1/spans/query`. The preflight `validate()` variant returns
 * `{ valid: false, error }` instead of throwing so callers can branch
 * without try/catch.
 *
 * Because `InvalidFilterError` extends the shared `ValidationError`,
 * `catch (e instanceof ValidationError)` (HTTP-family catch) AND
 * `catch (e instanceof InvalidFilterError)` (filter-specific catch) both
 * match.
 */
export class InvalidFilterError extends ValidationError {
  /** The invalid filter expression */
  readonly filter: string;

  constructor(filter: string, details?: string) {
    const message = details
      ? `Invalid filter '${filter}': ${details}`
      : `Invalid filter '${filter}'`;
    super(message, { details: { filter } });
    this.name = 'InvalidFilterError';
    this.filter = filter;
    Object.setPrototypeOf(this, InvalidFilterError.prototype);
  }
}
