/**
 * Type definitions for Brokle AWS Bedrock integration
 */

import type { BrokleOptions } from '../../index';

/**
 * Options for the Bedrock wrapper
 */
export interface BedrockWrapperOptions extends BrokleOptions {
  /**
   * Whether to capture guardrail information
   * @default true
   */
  captureGuardrails?: boolean;
}

/**
 * Bedrock Converse response attributes
 */
export interface BedrockConverseAttributes {
  modelId?: string;
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  outputMessages?: Array<{
    role: string;
    content: string | null;
  }>;
  metrics?: {
    latencyMs?: number;
  };
}

/**
 * Bedrock-specific metadata
 */
export interface BedrockMetadata {
  region?: string;
  guardrailId?: string;
  guardrailVersion?: string;
}
