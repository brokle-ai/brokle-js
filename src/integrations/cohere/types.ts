/**
 * Type definitions for Brokle Cohere integration
 */

import type { BrokleOptions } from '../../index';

/**
 * Options for the Cohere wrapper
 */
export interface CohereWrapperOptions extends BrokleOptions {
  /**
   * Whether to capture web search results metadata
   * @default true
   */
  captureWebSearch?: boolean;

  /**
   * Whether to capture document metadata in RAG operations
   * @default true
   */
  captureDocuments?: boolean;
}

/**
 * Cohere chat response attributes
 */
export interface CohereChatAttributes {
  responseId?: string;
  generationId?: string;
  finishReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  outputMessages?: Array<{
    role: string;
    content: string | null;
  }>;
  billedUnits?: {
    inputTokens?: number;
    outputTokens?: number;
    searchUnits?: number;
  };
  citations?: unknown[];
  searchResults?: unknown[];
}

/**
 * Cohere-specific metadata
 */
export interface CohereMetadata {
  model?: string;
  connectors?: string[];
  preamble?: string;
}
