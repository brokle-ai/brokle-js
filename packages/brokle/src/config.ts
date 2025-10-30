/**
 * Configuration management and validation
 */

import type { BrokleConfig, BrokleConfigInput } from './types/config';
import { DEFAULT_CONFIG } from './types/config';

/**
 * Validates API key format
 * Expected format: bk_{40_char_random}
 */
function validateApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (!apiKey.startsWith('bk_')) {
    throw new Error('Invalid API key format: must start with "bk_"');
  }

  if (apiKey.length !== 43) {
    throw new Error(`Invalid API key format: expected 43 characters (bk_ + 40 chars), got ${apiKey.length}`);
  }

  // Validate that it's alphanumeric after prefix
  const secret = apiKey.substring(3);
  if (!/^[a-zA-Z0-9]{40}$/.test(secret)) {
    throw new Error('Invalid API key format: secret must be 40 alphanumeric characters');
  }
}

/**
 * Validates sample rate
 */
function validateSampleRate(sampleRate: number): void {
  // Check for NaN (from invalid parseFloat)
  if (Number.isNaN(sampleRate)) {
    throw new Error('Invalid sample rate: must be a valid number, got NaN (check BROKLE_SAMPLE_RATE environment variable)');
  }

  // Check for Infinity (from parseFloat("Infinity"))
  if (!Number.isFinite(sampleRate)) {
    throw new Error(`Invalid sample rate: must be a finite number, got ${sampleRate}`);
  }

  // Check range
  if (sampleRate < 0 || sampleRate > 1) {
    throw new Error(`Invalid sample rate: must be between 0.0 and 1.0, got ${sampleRate}`);
  }
}

/**
 * Validates base URL format
 */
function validateBaseUrl(baseUrl: string): void {
  try {
    new URL(baseUrl);
  } catch {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }
}

/**
 * Loads configuration from environment variables
 */
export function loadFromEnv(): BrokleConfigInput {
  const apiKey = process.env.BROKLE_API_KEY;
  if (!apiKey) {
    throw new Error('BROKLE_API_KEY environment variable is required');
  }

  return {
    apiKey,
    baseUrl: process.env.BROKLE_BASE_URL,
    environment: process.env.BROKLE_ENVIRONMENT,
    debug: process.env.BROKLE_DEBUG === 'true',
    tracingEnabled: process.env.BROKLE_TRACING_ENABLED !== 'false',
    release: process.env.BROKLE_RELEASE,
    sampleRate: process.env.BROKLE_SAMPLE_RATE
      ? parseFloat(process.env.BROKLE_SAMPLE_RATE)
      : undefined,
    flushAt: process.env.BROKLE_FLUSH_AT
      ? parseInt(process.env.BROKLE_FLUSH_AT, 10)
      : undefined,
    flushInterval: process.env.BROKLE_FLUSH_INTERVAL
      ? parseInt(process.env.BROKLE_FLUSH_INTERVAL, 10)
      : undefined,
    flushSync: process.env.BROKLE_FLUSH_SYNC === 'true',
    maxQueueSize: process.env.BROKLE_MAX_QUEUE_SIZE
      ? parseInt(process.env.BROKLE_MAX_QUEUE_SIZE, 10)
      : undefined,
    timeout: process.env.BROKLE_TIMEOUT
      ? parseInt(process.env.BROKLE_TIMEOUT, 10)
      : undefined,
  };
}

/**
 * Validates and normalizes configuration
 */
export function validateConfig(input: BrokleConfigInput): BrokleConfig {
  // Validate API key
  validateApiKey(input.apiKey);

  // Merge with defaults
  const config: BrokleConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl || DEFAULT_CONFIG.baseUrl,
    environment: input.environment || DEFAULT_CONFIG.environment,
    debug: input.debug ?? DEFAULT_CONFIG.debug,
    tracingEnabled: input.tracingEnabled ?? DEFAULT_CONFIG.tracingEnabled,
    release: input.release || DEFAULT_CONFIG.release,
    sampleRate: input.sampleRate ?? DEFAULT_CONFIG.sampleRate,
    flushAt: input.flushAt ?? DEFAULT_CONFIG.flushAt,
    flushInterval: input.flushInterval ?? DEFAULT_CONFIG.flushInterval,
    flushSync: input.flushSync ?? DEFAULT_CONFIG.flushSync,
    maxQueueSize: input.maxQueueSize ?? DEFAULT_CONFIG.maxQueueSize,
    timeout: input.timeout ?? DEFAULT_CONFIG.timeout,
  };

  // Validate base URL
  validateBaseUrl(config.baseUrl);

  // Validate sample rate
  validateSampleRate(config.sampleRate);

  // Validate flush configuration
  if (config.flushAt <= 0) {
    throw new Error('flushAt must be greater than 0');
  }

  if (config.flushInterval <= 0) {
    throw new Error('flushInterval must be greater than 0');
  }

  if (config.maxQueueSize <= 0) {
    throw new Error('maxQueueSize must be greater than 0');
  }

  if (config.timeout <= 0) {
    throw new Error('timeout must be greater than 0');
  }

  return config;
}

