/**
 * Type definitions for Brokle Mistral AI integration
 */

import type { BrokleOptions } from '../../index';

/**
 * Options for the Mistral wrapper
 */
export interface MistralWrapperOptions extends BrokleOptions {
  /**
   * Whether to capture tool calls in traces
   * @default true
   */
  captureToolCalls?: boolean;
}

/**
 * Mistral chat completion attributes
 */
export interface MistralChatAttributes {
  responseId?: string;
  responseModel?: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  outputMessages?: Array<{
    role: string;
    content: string | null;
    toolCalls?: unknown[];
  }>;
}

/**
 * Mistral embedding attributes
 */
export interface MistralEmbeddingAttributes {
  model?: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}
