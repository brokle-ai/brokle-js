/**
 * Type definitions for Brokle Vercel AI SDK integration
 */

import type { Tracer } from '@opentelemetry/api';

/**
 * Vercel AI SDK experimental_telemetry configuration
 */
export interface ExperimentalTelemetry {
  /**
   * Enable or disable telemetry. Default is false (disabled).
   */
  isEnabled: boolean;

  /**
   * Identifier for the function. Used as the span name.
   */
  functionId?: string;

  /**
   * Additional custom metadata to include in spans.
   */
  metadata?: Record<string, string | number | boolean | undefined>;

  /**
   * Custom OpenTelemetry tracer to use.
   */
  tracer?: Tracer;

  /**
   * Whether to record inputs. Default is true.
   */
  recordInputs?: boolean;

  /**
   * Whether to record outputs. Default is true.
   */
  recordOutputs?: boolean;
}

/**
 * Brokle-specific telemetry configuration options
 */
export interface BrokleTelemetryConfig {
  /**
   * Identifier for the function. Used as the span name.
   * If not provided, defaults to the AI SDK function name.
   */
  functionId?: string;

  /**
   * User ID for attribution and analytics.
   */
  userId?: string;

  /**
   * Session ID for grouping related requests.
   */
  sessionId?: string;

  /**
   * Prompt ID/name for prompt management linking.
   */
  promptId?: string;

  /**
   * Prompt version for prompt management linking.
   */
  promptVersion?: string;

  /**
   * Additional custom metadata to include in spans.
   */
  metadata?: Record<string, string | number | boolean | undefined>;

  /**
   * Whether to record inputs. Default is true.
   */
  recordInputs?: boolean;

  /**
   * Whether to record outputs. Default is true.
   */
  recordOutputs?: boolean;
}

/**
 * Generic AI function signature (generateText, streamText, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AIFunction = (params: any) => Promise<any>;

/**
 * Map of AI functions to wrap
 */
export interface AIFunctions {
  generateText?: AIFunction;
  streamText?: AIFunction;
  generateObject?: AIFunction;
  streamObject?: AIFunction;
  embed?: AIFunction;
  embedMany?: AIFunction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: AIFunction | any;
}

/**
 * Wrapped AI functions with automatic telemetry
 */
export type WrappedAIFunctions<T extends AIFunctions> = {
  [K in keyof T]: T[K];
};

/**
 * Brokle options that can be passed in AI function params
 */
export interface BrokleAIOptions {
  /**
   * Brokle-specific options to merge with telemetry config
   */
  brokle?: BrokleTelemetryConfig;
}
