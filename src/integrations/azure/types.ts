/**
 * Type definitions for Brokle Azure OpenAI integration
 */

import type { BrokleOptions } from '../../index';

/**
 * Options for the Azure OpenAI wrapper
 */
export interface AzureOpenAIWrapperOptions extends BrokleOptions {
  /**
   * Whether to capture Azure-specific metadata
   * @default true
   */
  captureAzureMetadata?: boolean;
}

/**
 * Azure OpenAI specific metadata
 */
export interface AzureMetadata {
  deploymentName?: string;
  resourceName?: string;
  apiVersion?: string;
  endpoint?: string;
}

/**
 * Azure OpenAI response attributes
 */
export interface AzureChatCompletionAttributes {
  responseId?: string;
  responseModel?: string;
  finishReasons?: string[];
  systemFingerprint?: string;
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
  azureMetadata?: AzureMetadata;
}
