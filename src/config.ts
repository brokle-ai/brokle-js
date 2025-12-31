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
 * Safely parse integer from environment variable.
 * Returns undefined for empty/invalid values to fall back to defaults.
 */
function parseIntEnv(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse boolean from environment variable string.
 * Returns true for: 'true', '1', 'yes', 'on' (case-insensitive)
 * Returns false for: 'false', '0', 'no', 'off' (case-insensitive)
 */
function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  const lower = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(lower)) return true;
  if (['false', '0', 'no', 'off'].includes(lower)) return false;
  return defaultValue;
}

/**
 * Loads configuration from environment variables
 */
export function loadFromEnv(): BrokleConfigInput {
  // Check BROKLE_ENABLED FIRST (before API key validation)
  const enabled = parseBoolEnv(process.env.BROKLE_ENABLED, true);

  const apiKey = process.env.BROKLE_API_KEY;
  if (!apiKey && enabled) {
    throw new Error('BROKLE_API_KEY environment variable is required');
  }

  return {
    enabled,
    // Use placeholder when disabled (will pass validation since enabled=false)
    apiKey: apiKey || 'bk_disabled_placeholder_0000000000000000',
    baseUrl: process.env.BROKLE_BASE_URL,
    environment: process.env.BROKLE_ENVIRONMENT,
    debug: process.env.BROKLE_DEBUG === 'true',
    tracingEnabled: process.env.BROKLE_TRACING_ENABLED !== 'false',
    metricsEnabled: process.env.BROKLE_METRICS_ENABLED !== 'false',
    logsEnabled: process.env.BROKLE_LOGS_ENABLED === 'true', // Opt-in
    release: process.env.BROKLE_RELEASE,
    version: process.env.BROKLE_VERSION,
    sampleRate: process.env.BROKLE_SAMPLE_RATE
      ? parseFloat(process.env.BROKLE_SAMPLE_RATE)
      : undefined,
    flushAt: parseIntEnv(process.env.BROKLE_FLUSH_AT),
    flushInterval: parseIntEnv(process.env.BROKLE_FLUSH_INTERVAL),
    flushSync: process.env.BROKLE_FLUSH_SYNC === 'true',
    maxQueueSize: parseIntEnv(process.env.BROKLE_MAX_QUEUE_SIZE),
    timeout: parseIntEnv(process.env.BROKLE_TIMEOUT),
    transport: process.env.BROKLE_TRANSPORT as 'http' | 'grpc' | undefined,
    grpcEndpoint: process.env.BROKLE_GRPC_ENDPOINT,
    metricsInterval: parseIntEnv(process.env.BROKLE_METRICS_INTERVAL),
  };
}

/**
 * Validates and normalizes configuration
 */
export function validateConfig(input: BrokleConfigInput): BrokleConfig {
  const enabled = input.enabled ?? DEFAULT_CONFIG.enabled;

  // Skip all validation if disabled
  if (!enabled) {
    return {
      ...DEFAULT_CONFIG,
      ...input,
      enabled: false,
      apiKey: input.apiKey || 'bk_disabled_placeholder_0000000000000000',
      baseUrl: input.baseUrl || DEFAULT_CONFIG.baseUrl,
      environment: input.environment || DEFAULT_CONFIG.environment,
      debug: input.debug ?? DEFAULT_CONFIG.debug,
      tracingEnabled: input.tracingEnabled ?? DEFAULT_CONFIG.tracingEnabled,
      metricsEnabled: input.metricsEnabled ?? DEFAULT_CONFIG.metricsEnabled,
      logsEnabled: input.logsEnabled ?? DEFAULT_CONFIG.logsEnabled,
      release: input.release || DEFAULT_CONFIG.release,
      version: input.version || DEFAULT_CONFIG.version,
      sampleRate: input.sampleRate ?? DEFAULT_CONFIG.sampleRate,
      flushAt: input.flushAt ?? DEFAULT_CONFIG.flushAt,
      flushInterval: input.flushInterval ?? DEFAULT_CONFIG.flushInterval,
      flushSync: input.flushSync ?? DEFAULT_CONFIG.flushSync,
      maxQueueSize: input.maxQueueSize ?? DEFAULT_CONFIG.maxQueueSize,
      timeout: input.timeout ?? DEFAULT_CONFIG.timeout,
      transport: input.transport ?? DEFAULT_CONFIG.transport,
      grpcEndpoint: input.grpcEndpoint,
      metricsInterval: input.metricsInterval ?? DEFAULT_CONFIG.metricsInterval,
    };
  }

  // Validate API key only when enabled
  if (!input.apiKey) {
    throw new Error('API key is required');
  }
  validateApiKey(input.apiKey);

  const config: BrokleConfig = {
    ...DEFAULT_CONFIG,
    ...input,
    enabled: true,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl || DEFAULT_CONFIG.baseUrl,
    environment: input.environment || DEFAULT_CONFIG.environment,
    debug: input.debug ?? DEFAULT_CONFIG.debug,
    tracingEnabled: input.tracingEnabled ?? DEFAULT_CONFIG.tracingEnabled,
    metricsEnabled: input.metricsEnabled ?? DEFAULT_CONFIG.metricsEnabled,
    logsEnabled: input.logsEnabled ?? DEFAULT_CONFIG.logsEnabled,
    release: input.release || DEFAULT_CONFIG.release,
    version: input.version || DEFAULT_CONFIG.version,
    sampleRate: input.sampleRate ?? DEFAULT_CONFIG.sampleRate,
    flushAt: input.flushAt ?? DEFAULT_CONFIG.flushAt,
    flushInterval: input.flushInterval ?? DEFAULT_CONFIG.flushInterval,
    flushSync: input.flushSync ?? DEFAULT_CONFIG.flushSync,
    maxQueueSize: input.maxQueueSize ?? DEFAULT_CONFIG.maxQueueSize,
    timeout: input.timeout ?? DEFAULT_CONFIG.timeout,
    transport: input.transport ?? DEFAULT_CONFIG.transport,
    grpcEndpoint: input.grpcEndpoint,
    metricsInterval: input.metricsInterval ?? DEFAULT_CONFIG.metricsInterval,
  };

  validateBaseUrl(config.baseUrl);
  validateSampleRate(config.sampleRate);

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

  if (config.metricsInterval <= 0) {
    throw new Error('metricsInterval must be greater than 0');
  }

  if (config.transport && !['http', 'grpc'].includes(config.transport)) {
    throw new Error(`Invalid transport: ${config.transport}. Must be 'http' or 'grpc'`);
  }

  return config;
}

