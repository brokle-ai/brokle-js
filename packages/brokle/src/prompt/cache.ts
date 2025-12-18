/**
 * LRU Cache with TTL and Stale-While-Revalidate support
 *
 * Provides efficient caching for prompt data with automatic expiration
 * and background refresh capabilities.
 */

import type { CacheEntry } from './types';

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Maximum number of entries (default: 100) */
  maxSize?: number;
  /** Default TTL in seconds (default: 60) */
  defaultTTL?: number;
  /** Enable stale-while-revalidate (default: true) */
  staleWhileRevalidate?: boolean;
  /** Stale grace period in seconds (default: 30) */
  staleGracePeriod?: number;
}

/**
 * LRU Cache with TTL and SWR support
 */
export class PromptCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private defaultTTL: number;
  private staleWhileRevalidate: boolean;
  private staleGracePeriod: number;
  private refreshing: Set<string>;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 100;
    this.defaultTTL = options.defaultTTL ?? 60;
    this.staleWhileRevalidate = options.staleWhileRevalidate ?? true;
    this.staleGracePeriod = options.staleGracePeriod ?? 30;
    this.refreshing = new Set();
  }

  /**
   * Get an entry from the cache
   *
   * @param key - Cache key
   * @returns Cached data or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    const age = (now - entry.fetchedAt) / 1000;

    if (age < entry.ttl) {
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.data;
    }

    if (this.staleWhileRevalidate && age < entry.ttl + this.staleGracePeriod) {
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.data;
    }

    this.cache.delete(key);
    return undefined;
  }

  /**
   * Check if an entry exists and is fresh
   *
   * @param key - Cache key
   * @returns true if entry exists and is not stale
   */
  isFresh(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = (Date.now() - entry.fetchedAt) / 1000;
    return age < entry.ttl;
  }

  /**
   * Check if an entry is stale but within SWR grace period
   *
   * @param key - Cache key
   * @returns true if stale but usable
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = (Date.now() - entry.fetchedAt) / 1000;
    return age >= entry.ttl && age < entry.ttl + this.staleGracePeriod;
  }

  /**
   * Check if a key is currently being refreshed
   *
   * @param key - Cache key
   * @returns true if refresh in progress
   */
  isRefreshing(key: string): boolean {
    return this.refreshing.has(key);
  }

  /**
   * Mark a key as being refreshed
   *
   * @param key - Cache key
   */
  startRefresh(key: string): void {
    this.refreshing.add(key);
  }

  /**
   * Mark a key as done refreshing
   *
   * @param key - Cache key
   */
  endRefresh(key: string): void {
    this.refreshing.delete(key);
  }

  /**
   * Set an entry in the cache
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - TTL in seconds (optional, uses default)
   */
  set(key: string, data: T, ttl?: number): void {
    // Short-circuit if cache is disabled (maxSize <= 0)
    if (this.maxSize <= 0) {
      return;
    }

    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      fetchedAt: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  /**
   * Delete an entry from the cache
   *
   * @param key - Cache key
   * @returns true if entry was deleted
   */
  delete(key: string): boolean {
    this.refreshing.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Delete all cache entries for a specific prompt by name
   *
   * Removes all entries matching the pattern: prompt:{name}:*
   * This includes all labels (latest, production, beta, canary, etc.)
   * and all versions (v1, v2, v3, etc.)
   *
   * @param name - Prompt name
   * @returns Number of entries deleted
   */
  deleteByPrompt(name: string): number {
    const prefix = `prompt:${name}:`;
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        if (this.cache.delete(key)) {
          deleted++;
        }
        this.refreshing.delete(key);
      }
    }

    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.refreshing.clear();
  }

  /**
   * Get the current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    refreshingCount: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      refreshingCount: this.refreshing.size,
    };
  }

  /**
   * Generate a cache key for a prompt
   *
   * @param name - Prompt name
   * @param options - Fetch options (label or version)
   * @returns Cache key string
   */
  static generateKey(
    name: string,
    options?: { label?: string; version?: number }
  ): string {
    if (options?.version !== undefined) {
      return `prompt:${name}:v${options.version}`;
    }
    if (options?.label) {
      return `prompt:${name}:${options.label}`;
    }
    return `prompt:${name}:latest`;
  }
}
