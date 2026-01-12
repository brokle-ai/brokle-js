/**
 * Type definitions for Brokle Google GenAI integration
 */

import type { BrokleOptions } from '../../index';

/**
 * Options for the Google GenAI wrapper
 */
export interface GoogleGenAIWrapperOptions extends BrokleOptions {
  /**
   * Whether to capture safety ratings in traces
   * @default true
   */
  captureSafetyRatings?: boolean;
}

/**
 * Google GenerativeModel content generation attributes
 */
export interface GenerateContentAttributes {
  responseId?: string;
  responseModel?: string;
  finishReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  outputText?: string;
}
