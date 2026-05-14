/**
 * Shared HTTP client for Brokle API communication.
 *
 * Mirrors `sdk/python/brokle/_http/client.py` — raw success bodies
 * on 2xx, typed exceptions on 4xx/5xx. Replaces ~15 duplicated
 * `httpGet`/`httpPost` helpers that previously lived inside every
 * resource manager (prompt, scores, query, experiments, annotations,
 * datasets, scorers).
 *
 * Wire contract (Stripe/OpenAI-style):
 *
 *   - Success (2xx): raw resource body (single) or
 *     `{"data":[...], "pagination":{...}}` (list) — returned as `T`.
 *   - Success (204): returns `undefined`.
 *   - Error   (4xx/5xx): `{"error":{"type","code","message",...}}`;
 *     parsed into the matching `Brokle*Error` subclass and thrown.
 *
 * No `success` boolean is consulted anywhere. HTTP status is the
 * canonical signal, per RFC 9110 §15.
 */

import {
  AuthenticationError,
  BrokleError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from '../errors';

/** Options shared by every request. */
export interface HttpClientOptions {
  /** Absolute backend URL, e.g. `http://localhost:8080`. */
  baseUrl: string;
  /** Brokle API key (sent as `X-API-Key`). */
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 30 000. */
  timeout?: number;
}

/** Per-request options that override client defaults. */
export interface RequestOptions {
  /** Query parameters serialised into the URL. */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request-specific timeout (ms). */
  timeout?: number;
  /** Extra headers merged onto the defaults. */
  headers?: Record<string, string>;
  /**
   * Optional resource type passed to `NotFoundError.forResource` on
   * 404 responses. When both `resourceType` and `identifier` are set,
   * the 404 carries a user-friendly "X with id Y not found" message.
   */
  resourceType?: string;
  /** Identifier paired with `resourceType` for 404 messages. */
  identifier?: string;
}

/**
 * BrokleHttpClient is the single HTTP surface every resource manager
 * shares. All Brokle dashboard + SDK REST traffic flows through one
 * of its methods, so error classification, retry policy, cookie
 * forwarding (none — SDK uses `X-API-Key`), and observability hooks
 * live in exactly one place.
 */
export class BrokleHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultTimeout: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Trim trailing slash.
    this.apiKey = options.apiKey;
    this.defaultTimeout = options.timeout ?? 30_000;
  }

  async get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const timeout = options?.timeout ?? this.defaultTimeout;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...options?.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      // Transport failure (DNS, connection refused, abort). Always a
      // ConnectionError — this branch never sees HTTP status codes.
      if (err instanceof Error) {
        throw ConnectionError.fromError(err, this.baseUrl);
      }
      throw new ConnectionError(`Network error: ${String(err)}`, {
        details: { baseUrl: this.baseUrl },
      });
    }
    clearTimeout(timer);

    await this.raiseForStatus(response, options);
    return (await this.parseBody(response)) as T;
  }

  /**
   * Construct the full URL for a path + optional query parameters.
   * Skips keys whose value is `undefined`/`null` (matches Python's
   * `httpx` behavior).
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const full = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    if (!params) return full;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const query = qs.toString();
    return query ? `${full}?${query}` : full;
  }

  /**
   * Check HTTP status and raise the matching typed exception on
   * 4xx/5xx. Mirrors Python's `_check_response_status`.
   */
  private async raiseForStatus(
    response: Response,
    options?: RequestOptions,
  ): Promise<void> {
    if (response.ok) return; // 2xx — caller proceeds to parseBody.

    const body = await this.readErrorBody(response);
    const status = response.status;

    if (status === 401 || status === 403) {
      throw AuthenticationError.fromResponse(status, body);
    }
    if (status === 404) {
      if (options?.resourceType && options.identifier) {
        throw NotFoundError.forResource(options.resourceType, options.identifier);
      }
      throw new NotFoundError(`Resource not found (HTTP ${status})`, {
        hint: 'Check the resource identifier and project context.',
        details: { statusCode: status, response: body },
      });
    }
    if (status === 422) {
      throw ValidationError.fromResponse(body ?? {});
    }
    if (status === 429) {
      const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
      throw RateLimitError.fromResponse(body, retryAfter);
    }
    if (status >= 500) {
      throw ServerError.fromResponse(status, body);
    }

    // Catch-all for other 4xx statuses (400, 405, 409, 415, …).
    const msg =
      ((body?.error as Record<string, unknown>)?.message as string) ??
      `Request failed (HTTP ${status})`;
    throw new BrokleError(msg, {
      hint: 'Check the request parameters and API documentation.',
      details: { statusCode: status, response: body },
    });
  }

  /**
   * Decode the error body. Returns `undefined` when the body is
   * empty or not valid JSON (some proxies inject HTML error pages);
   * downstream classifiers handle the undefined case.
   */
  private async readErrorBody(
    response: Response,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      const text = await response.text();
      if (!text) return undefined;
      const parsed = JSON.parse(text) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Decode the success body. Returns `undefined` on 204 responses
   * (no content) — matches fetch's built-in behavior for empty
   * bodies. Any JSON-parse error on a 2xx response becomes a
   * BrokleError — the backend broke its own contract.
   */
  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new BrokleError(
        `Failed to parse 2xx response body as JSON: ${(err as Error).message}`,
        {
          details: {
            statusCode: response.status,
            // Keep first 500 chars of the body for debugging without
            // accidentally dumping a multi-MB HTML page into logs.
            bodyPreview: text.slice(0, 500),
          },
        },
      );
    }
  }

  /**
   * Parse the `Retry-After` header per RFC 7231 — either seconds
   * (numeric) or an HTTP-date. Returns `undefined` for empty/invalid
   * values; the caller falls back to its own backoff policy.
   */
  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, Math.floor(seconds));
    const date = Date.parse(header);
    if (Number.isNaN(date)) return undefined;
    const deltaMs = date - Date.now();
    return deltaMs > 0 ? Math.floor(deltaMs / 1000) : 0;
  }
}
