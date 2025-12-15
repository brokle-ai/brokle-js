/**
 * Prompt Manager
 *
 * Manager for fetching and managing prompts from the Brokle API.
 * Supports caching with stale-while-revalidate pattern.
 */

import type {
  PromptData,
  PromptConfig,
  GetPromptOptions,
  ListPromptsOptions,
  PaginatedResponse,
  UpsertPromptRequest,
  APIResponse,
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
  private baseUrl: string;
  private apiKey: string;
  private cache: PromptCache<PromptData>;
  private debug: boolean;
  private maxRetries: number;
  private retryDelay: number;
  private cacheTtlSeconds: number;

  constructor(config: PromptManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
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

  /**
   * Make an HTTP GET request
   */
  private async httpGet<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make an HTTP POST request
   */
  private async httpPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Log debug messages
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle PromptManager] ${message}`, ...args);
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Extract status code from error
   */
  private extractStatusCode(error: any): number | undefined {
    if (typeof error?.message === 'string') {
      const match = error.message.match(/\((\d{3})\)/);
      if (match) return parseInt(match[1], 10);
    }
    return undefined;
  }

  /**
   * Map error code to HTTP status code
   */
  private mapErrorCodeToStatus(code: string): number {
    const mapping: Record<string, number> = {
      not_found: 404,
      validation_error: 400,
      unauthorized: 401,
      forbidden: 403,
      conflict: 409,
      rate_limit: 429,
      internal_error: 500,
    };
    return mapping[code] ?? 500;
  }

  /**
   * Unwrap API response envelope
   *
   * Backend returns: {"success": bool, "data": {...}, "error": {...}, "meta": {...}}
   * This extracts the data or throws appropriate error.
   */
  private unwrapResponse<T>(
    response: APIResponse<T>,
    promptName?: string,
    options?: { version?: number; label?: string }
  ): T {
    // Check for error response
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new PromptFetchError('Request failed with no error details');
      }

      // Map error types to exceptions
      if (
        (error.type === 'not_found' || error.code === 'not_found') &&
        promptName
      ) {
        throw new PromptNotFoundError(promptName, options);
      }

      throw new PromptFetchError(
        `${error.code}: ${error.message}`,
        this.mapErrorCodeToStatus(error.code)
      );
    }

    // Extract data
    if (response.data === undefined) {
      throw new PromptFetchError('Response missing data field');
    }

    return response.data;
  }

  /**
   * Unwrap paginated API response
   *
   * Returns both the data array and pagination info.
   */
  private unwrapPaginatedResponse<T>(
    response: APIResponse<T[]>
  ): { data: T[]; pagination: APIPagination } {
    // Check for error response
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new PromptFetchError('Request failed with no error details');
      }

      throw new PromptFetchError(
        `${error.code}: ${error.message}`,
        this.mapErrorCodeToStatus(error.code)
      );
    }

    const data = response.data ?? [];
    const pagination = response.meta?.pagination ?? {
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };

    return { data, pagination };
  }

  /**
   * Make HTTP GET with retry logic
   */
  private async httpGetWithRetry<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    promptName?: string,
    options?: { version?: number; label?: string }
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.httpGet<T>(path, params);
      } catch (error) {
        lastError = error as Error;
        const statusCode = this.extractStatusCode(error);

        if (statusCode === 404 && promptName) {
          throw new PromptNotFoundError(promptName, options);
        }

        // Don't retry on 4xx errors (except 429 rate limit)
        if (
          statusCode &&
          statusCode >= 400 &&
          statusCode < 500 &&
          statusCode !== 429
        ) {
          throw new PromptFetchError(
            `HTTP ${statusCode}: ${(error as Error).message}`,
            statusCode
          );
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.log(
            `Request failed, retrying in ${delay}ms (attempt ${attempt + 1})`
          );
          await this.sleep(delay);
        }
      }
    }

    throw new PromptFetchError(
      `Request failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
      this.extractStatusCode(lastError)
    );
  }

  /**
   * Make HTTP POST with retry logic
   */
  private async httpPostWithRetry<T>(
    path: string,
    body: unknown
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.httpPost<T>(path, body);
      } catch (error) {
        lastError = error as Error;
        const statusCode = this.extractStatusCode(error);

        // Don't retry on 4xx errors (except 429)
        if (
          statusCode &&
          statusCode >= 400 &&
          statusCode < 500 &&
          statusCode !== 429
        ) {
          throw new PromptFetchError(
            `HTTP ${statusCode}: ${(error as Error).message}`,
            statusCode
          );
        }

        // Exponential backoff
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          this.log(
            `Request failed, retrying in ${delay}ms (attempt ${attempt + 1})`
          );
          await this.sleep(delay);
        }
      }
    }

    throw new PromptFetchError(
      `Request failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Fetch a prompt from the API (internal method)
   */
  private async fetchPrompt(
    name: string,
    options?: GetPromptOptions
  ): Promise<PromptData> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.label) params.label = options.label;
    if (options?.version !== undefined) params.version = options.version;

    this.log(`Fetching prompt: ${name}`, params);

    const rawResponse = await this.httpGetWithRetry<APIResponse<PromptData>>(
      `/v1/prompts/${name}`,
      params,
      name,
      { version: options?.version, label: options?.label }
    );

    return this.unwrapResponse(rawResponse, name, {
      version: options?.version,
      label: options?.label,
    });
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
    const rawResponse = await this.httpGet<APIResponse<PromptData[]>>(
      '/v1/prompts',
      params
    );
    const { data, pagination } = this.unwrapPaginatedResponse(rawResponse);

    return {
      data: data.map((d) => Prompt.fromData(d)),
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
    const rawResponse = await this.httpPostWithRetry<APIResponse<PromptData>>(
      '/v1/prompts',
      request
    );
    this.unwrapResponse(rawResponse, request.name);

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
