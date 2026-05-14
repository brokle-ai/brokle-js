/**
 * Prompt Manager
 *
 * Manager for fetching and managing prompts from the Brokle API.
 * Supports caching with stale-while-revalidate pattern.
 */

import { BrokleHttpClient } from '../_http';
import {
  BrokleError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from '../errors';
import type {
  PromptData,
  PromptConfig,
  GetPromptOptions,
  ListPromptsOptions,
  PaginatedResponse,
  UpsertPromptRequest,
  APIPagination,
} from './types';
import { PromptCache, type CacheOptions } from './cache';
import { Prompt } from './prompt';
import { PromptNotFoundError, PromptFetchError } from './errors';

/**
 * Configuration for the prompt manager
 */
export interface PromptManagerConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Client configuration with cache and retry settings */
  config?: PromptConfig;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Prompt API manager with caching and SWR support
 */
export class PromptManager {
  private http: BrokleHttpClient;
  private cache: PromptCache<PromptData>;
  private debug: boolean;
  private maxRetries: number;
  private retryDelay: number;
  private cacheTtlSeconds: number;

  constructor(config: PromptManagerConfig) {
    this.http = new BrokleHttpClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.debug = config.debug ?? false;

    const promptConfig = config.config ?? {};

    if (promptConfig.cacheEnabled !== false) {
      const cacheOptions: CacheOptions = {
        maxSize: promptConfig.cacheMaxSize ?? 1000,
        defaultTTL: promptConfig.cacheTtlSeconds ?? 60,
      };
      this.cache = new PromptCache(cacheOptions);
    } else {
      this.cache = new PromptCache({ maxSize: 0 });
    }

    this.maxRetries = promptConfig.maxRetries ?? 2;
    this.retryDelay = promptConfig.retryDelay ?? 1000;
    this.cacheTtlSeconds = promptConfig.cacheTtlSeconds ?? 60;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle PromptManager] ${message}`, ...args);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * withRetry wraps a single HTTP call with exponential-backoff retry.
   * Retries on 5xx and 429 (rate-limit); aborts immediately on other
   * 4xx errors (401/403/404/409/422 — deterministic, retrying never
   * helps). 404 is re-thrown as `PromptNotFoundError` when a prompt
   * name is provided so callers can distinguish missing-resource from
   * generic fetch failure.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    promptName?: string,
    options?: { version?: number; label?: string },
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // NotFound surfaces as a typed domain error immediately.
        if (error instanceof NotFoundError && promptName) {
          throw new PromptNotFoundError(promptName, options);
        }

        // Retryable: 5xx + rate limit. Everything else is final.
        const retryable =
          error instanceof ServerError || error instanceof RateLimitError;
        if (!retryable) {
          if (error instanceof BrokleError) {
            const status = error.details.statusCode;
            throw new PromptFetchError(
              `${error.message}`,
              typeof status === 'number' ? status : undefined,
            );
          }
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await this.sleep(delay);
        }
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    const status =
      lastError instanceof BrokleError && typeof lastError.details.statusCode === 'number'
        ? lastError.details.statusCode
        : undefined;
    throw new PromptFetchError(
      `Request failed after ${this.maxRetries + 1} attempts: ${message}`,
      status,
    );
  }

  /**
   * Fetch a prompt from the API (internal method)
   */
  private async fetchPrompt(
    name: string,
    options?: GetPromptOptions,
  ): Promise<PromptData> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.label) params.label = options.label;
    if (options?.version !== undefined) params.version = options.version;

    this.log(`Fetching prompt: ${name}`, params);

    // Retry wrapper catches transient server/rate-limit failures.
    // On 404 the shared HTTP client raises NotFoundError, which
    // withRetry converts to PromptNotFoundError(name, options).
    return this.withRetry(
      () =>
        this.http.get<PromptData>(`/v1/prompts/${name}`, {
          params,
          resourceType: 'prompt',
          identifier: name,
        }),
      name,
      { version: options?.version, label: options?.label },
    );
  }

  /**
   * Get a prompt by name with caching and optional fallback
   *
   * Priority order:
   * 1. Fresh cache - return immediately
   * 2. Fetch from API - cache and return
   * 3. Stale cache - return stale, trigger background refresh
   * 4. Fallback - create fallback prompt if provided
   * 5. Throw - if nothing available
   *
   * @param name - Prompt name
   * @param options - Fetch options (label, version, cache settings, fallback)
   * @returns Prompt instance (check `prompt.isFallback` to detect if fallback was used)
   *
   * @example
   * ```typescript
   * // Get latest version
   * const prompt = await client.get("greeting");
   *
   * // Get by label
   * const prodPrompt = await client.get("greeting", { label: "production" });
   *
   * // Get with text fallback (guaranteed availability)
   * const prompt = await client.get("greeting", {
   *   fallback: "Hello {{name}}!"
   * });
   *
   * // Get with chat fallback
   * const prompt = await client.get("assistant", {
   *   fallback: [
   *     { role: "system", content: "You are helpful." },
   *     { role: "user", content: "{{query}}" }
   *   ]
   * });
   *
   * // Check if fallback was used
   * if (prompt.isFallback) {
   *   console.warn("Using fallback prompt - API unavailable");
   * }
   * ```
   */
  async get(name: string, options?: GetPromptOptions): Promise<Prompt> {
    const cacheKey = PromptCache.generateKey(name, options);
    const ttl = options?.cacheTTL ?? this.cacheTtlSeconds;
    const fallback = options?.fallback;

    // Force refresh - skip cache, but use fallback on failure
    if (options?.forceRefresh) {
      this.log(`Force refresh: ${cacheKey}`);
      try {
        const data = await this.fetchPrompt(name, options);
        this.cache.set(cacheKey, data, ttl);
        return Prompt.fromData(data);
      } catch (fetchError) {
        if (fallback !== undefined) {
          this.log(`Force refresh failed, using fallback: ${name}`);
          return Prompt.createFallback(name, fallback);
        }
        throw fetchError;
      }
    }

    // Fresh cache - return immediately
    const cached = this.cache.get(cacheKey);
    if (cached && this.cache.isFresh(cacheKey)) {
      this.log(`Cache hit (fresh): ${cacheKey}`);
      return Prompt.fromData(cached);
    }

    // Try fetch from API
    try {
      this.log(`Cache miss: ${cacheKey}`);
      const data = await this.fetchPrompt(name, options);
      this.cache.set(cacheKey, data, ttl);
      return Prompt.fromData(data);
    } catch (fetchError) {
      // Stale cache - return stale and refresh in background
      if (cached) {
        this.log(`Fetch failed, using stale cache: ${cacheKey}`);

        // Trigger background refresh if not already in progress
        if (!this.cache.isRefreshing(cacheKey)) {
          this.cache.startRefresh(cacheKey);
          this.fetchPrompt(name, options)
            .then((data) => {
              this.cache.set(cacheKey, data, ttl);
              this.log(`Background refresh complete: ${cacheKey}`);
            })
            .catch((err) => {
              this.log(`Background refresh failed: ${err.message}`);
            })
            .finally(() => {
              this.cache.endRefresh(cacheKey);
            });
        }

        return Prompt.fromData(cached);
      }

      // Fallback - if provided, create fallback prompt
      if (fallback !== undefined) {
        this.log(`Fetch failed, using fallback: ${name}`);
        return Prompt.createFallback(name, fallback);
      }

      // No cache, no fallback - throw
      throw fetchError;
    }
  }

  /**
   * List prompts with optional filtering
   *
   * @param options - Filter and pagination options
   * @returns Paginated list of prompts
   *
   * @example
   * ```typescript
   * // List all prompts
   * const { data, pagination } = await client.list();
   *
   * // Filter by type and search
   * const chatPrompts = await client.list({
   *   type: "chat",
   *   search: "greeting",
   *   limit: 10
   * });
   * ```
   */
  async list(options?: ListPromptsOptions): Promise<PaginatedResponse<Prompt>> {
    const params: Record<string, string | number | undefined> = {
      page: options?.page,
      limit: options?.limit,
      type: options?.type,
      search: options?.search,
    };

    if (options?.tags?.length) {
      params.tags = options.tags.join(',');
    }

    this.log('Listing prompts', params);

    // List endpoints speak the Stripe/OpenAI contract: inline
    // `{data: [...], pagination: {...}}` body, no envelope wrapper.
    const body = await this.http.get<{
      data: PromptData[];
      pagination: APIPagination;
    }>('/v1/prompts', { params });
    const pagination = body.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };

    return {
      data: (body.data ?? []).map((d) => Prompt.fromData(d)),
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        pages: pagination.total_pages,
      },
    };
  }

  /**
   * Create or update a prompt (upsert)
   *
   * If the prompt exists, creates a new version.
   * If it doesn't exist, creates the prompt.
   *
   * @param request - Prompt data
   * @returns Created/updated prompt
   *
   * @example
   * ```typescript
   * // Create new prompt
   * const prompt = await client.upsert({
   *   name: "greeting",
   *   type: "text",
   *   template: { content: "Hello, {{name}}!" },
   *   commit_message: "Initial version"
   * });
   *
   * // Update existing (creates new version)
   * const v2 = await client.upsert({
   *   name: "greeting",
   *   type: "text",
   *   template: { content: "Hi there, {{name}}!" },
   *   commit_message: "Made greeting friendlier"
   * });
   * ```
   */
  async upsert(request: UpsertPromptRequest): Promise<Prompt> {
    this.log(`Upserting prompt: ${request.name}`);
    // Upsert with retry on transient failures. The response body is
    // the created/updated prompt, but we don't consume it — we
    // invalidate the cache and re-fetch via `get()` to ensure
    // the cached entry is the authoritative server-side shape.
    await this.withRetry(() =>
      this.http.post<PromptData>('/v1/prompts', request),
    );

    this.invalidate(request.name);

    return await this.get(request.name, { forceRefresh: true });
  }

  /**
   * Invalidate all cached entries for a prompt
   *
   * Removes all cached entries for the prompt name, regardless of
   * label or version. This ensures stale data is not served after
   * an upsert operation.
   *
   * @param name - Prompt name
   */
  invalidate(name: string): void {
    const count = this.cache.deleteByPrompt(name);
    this.log(`Invalidated ${count} cache entries for: ${name}`);
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    this.cache.clear();
    this.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; refreshingCount: number } {
    return this.cache.getStats();
  }

  /**
   * Create a prompt manager from environment variables
   */
  static fromEnv(options?: {
    config?: PromptConfig;
    debug?: boolean;
  }): PromptManager {
    const apiKey = process.env.BROKLE_API_KEY;
    if (!apiKey) {
      throw new Error('BROKLE_API_KEY environment variable not set');
    }

    const baseUrl = process.env.BROKLE_BASE_URL || 'http://localhost:8080';

    return new PromptManager({
      apiKey,
      baseUrl,
      config: options?.config,
      debug: options?.debug ?? process.env.BROKLE_DEBUG === 'true',
    });
  }
}
