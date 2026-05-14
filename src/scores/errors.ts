/**
 * Score Module Errors
 *
 * The scores module exposes ONE axis-2 error:
 *
 *   ScorerError  – a user-provided scorer function failed or returned
 *                  an unsupported value. Raised BEFORE any HTTP call
 *                  crosses the wire, so it never represents a backend
 *                  or transport failure — hence it extends `Error`, not
 *                  `BrokleError`.
 *
 * Every HTTP-layer failure (auth, network, validation, 5xx) propagates
 * as the shared `BrokleError` subclass the HTTP client raised — there
 * is no module-local wrapper by design. See `sdk/javascript/src/errors.ts`
 * and root CLAUDE.md gotcha on the two-axis error model.
 */

/**
 * A user-provided scorer function failed or returned an unsupported value.
 *
 * Raised purely client-side, before any request reaches the backend.
 * Catch directly or inspect `.scorerName` / `.cause` for diagnostics.
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
