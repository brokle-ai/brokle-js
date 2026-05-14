/**
 * QueryManager regression tests — locks the 422 discriminator.
 *
 * Symmetric with `sdk/python/tests/test_query_parse_failures.py`. A 422
 * response is promoted to `InvalidFilterError` only when the backend
 * signals the filter-parser rejection via
 * `error.code === "invalid_filter_expression"`. Every other 422 flavour
 * (invalid limit/page/timestamp, missing or unknown `code`) propagates
 * as the shared `ValidationError` with per-field diagnostics preserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { QueryManager } from './manager';
import { InvalidFilterError } from './errors';
import { ValidationError } from '../errors';

// Minimal mock of BrokleHttpClient that can be injected via the manager's
// private `http` field. Manager's constructor builds its own HTTP client
// from config; we override the `http` instance variable directly.
function makeManagerWithPostError(err: Error): QueryManager {
  const mgr = new QueryManager({
    baseUrl: 'http://localhost:8080',
    apiKey: 'bk_' + 'a'.repeat(40),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mgr as any).http = {
    post: vi.fn().mockRejectedValue(err),
  };
  return mgr;
}

function makeValidationError(body: Record<string, unknown>): ValidationError {
  return new ValidationError('Validation error: test', {
    details: { response: body },
  });
}

describe('QueryManager.query() — 422 discriminator', () => {
  it('promotes filter-code 422 to InvalidFilterError', async () => {
    const err = makeValidationError({
      error: {
        type: 'validation_error',
        code: 'invalid_filter_expression',
        message: 'invalid filter expression',
        details: 'unexpected token',
      },
    });
    const mgr = makeManagerWithPostError(err);

    await expect(mgr.query({ filter: 'service.name=' })).rejects.toBeInstanceOf(
      InvalidFilterError,
    );
    await expect(mgr.query({ filter: 'service.name=' })).rejects.toMatchObject({
      filter: 'service.name=',
    });
  });

  it('propagates generic-validation 422 as ValidationError with diagnostics', async () => {
    const err = makeValidationError({
      error: {
        type: 'validation_error',
        code: 'validation_error',
        message: 'validation failed',
        errors: [
          {
            location: 'body.limit',
            message: 'expected number <= 1000',
            value: 9999,
          },
        ],
      },
    });
    const mgr = makeManagerWithPostError(err);

    let caught: unknown;
    try {
      await mgr.query({ filter: 'service.name=x', limit: 9999 });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught).not.toBeInstanceOf(InvalidFilterError);
    const details = (caught as ValidationError).details as Record<string, unknown>;
    const response = details.response as Record<string, unknown>;
    const errorBody = response.error as Record<string, unknown>;
    const errorsArr = errorBody.errors as Array<Record<string, unknown>>;
    expect(errorsArr[0].location).toBe('body.limit');
  });

  it('propagates 422 without a code field as plain ValidationError', async () => {
    const err = makeValidationError({
      error: {
        type: 'validation_error',
        message: 'no code field on this one',
      },
    });
    const mgr = makeManagerWithPostError(err);

    let caught: unknown;
    try {
      await mgr.query({ filter: 'anything' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught).not.toBeInstanceOf(InvalidFilterError);
  });
});
