/**
 * Configuration types for Brokle SDK
 */

import type { TransportType } from '../transport/types';

/**
 * Input configuration from user (partial values allowed)
 */
export interface BrokleConfigInput {
  /** Brokle API key (format: bk_{40_char_random}) */
  apiKey: string;
  /** Base URL for Brokle API (default: http://localhost:8080) */
  baseUrl?: string;
  /** Environment tag (e.g., 'production', 'staging', 'development') */
  environment?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Enable/disable tracing (default: true) */
  tracingEnabled?: boolean;
  /** Enable/disable metrics (default: true) */
  metricsEnabled?: boolean;
  /** Enable/disable logs export (default: false, opt-in) */
  logsEnabled?: boolean;
  /** Release identifier for deployment tracking (e.g., 'v2.1.24', git commit hash) */
  release?: string;
  /** Trace-level version for A/B testing experiments (e.g., 'experiment-A', 'control') */
  version?: string;
  /** Trace-level sampling rate (0.0 to 1.0) */
  sampleRate?: number;
  /** PII masking function */
  mask?: (data: unknown) => unknown;
  /** Batch size before flushing to backend */
  flushAt?: number;
  /** Flush interval in seconds */
  flushInterval?: number;
  /** Use SimpleSpanProcessor instead of BatchSpanProcessor (for serverless) */
  flushSync?: boolean;
  /** Maximum queue size for batching */
  maxQueueSize?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Transport protocol for OTLP export (default: 'http') */
  transport?: TransportType | 'http' | 'grpc';
  /** gRPC endpoint (only used when transport is 'grpc') */
  grpcEndpoint?: string;
  /** Metrics export interval in milliseconds (default: 60000) */
  metricsInterval?: number;
}

/**
 * Fully resolved configuration with all defaults applied
 */
export interface BrokleConfig {
  apiKey: string;
  baseUrl: string;
  environment: string;
  debug: boolean;
  tracingEnabled: boolean;
  metricsEnabled: boolean;
  logsEnabled: boolean;
  release: string;
  version: string;
  sampleRate: number;
  mask?: (data: unknown) => unknown;
  flushAt: number;
  flushInterval: number;
  flushSync: boolean;
  maxQueueSize: number;
  timeout: number;
  transport: TransportType | 'http' | 'grpc';
  grpcEndpoint?: string;
  metricsInterval: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<BrokleConfig, 'apiKey'> = {
  baseUrl: 'http://localhost:8080',
  environment: 'default',
  debug: false,
  tracingEnabled: true,
  metricsEnabled: true,
  logsEnabled: false, // Opt-in, matching Python SDK
  release: '',
  version: '',
  sampleRate: 1.0,
  flushAt: 100,
  flushInterval: 10, // seconds
  flushSync: false,
  maxQueueSize: 10000,
  timeout: 30000, // 30 seconds
  transport: 'http',
  metricsInterval: 60000, // 60 seconds
};