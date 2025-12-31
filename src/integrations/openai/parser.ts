/**
 * Attribute Extraction from OpenAI Responses
 *
 * Parses OpenAI API responses to extract GenAI semantic convention attributes
 */

import type OpenAI from 'openai';

/**
 * Extracted chat completion attributes
 */
export interface ChatCompletionAttributes {
  responseId?: string;
  responseModel?: string;
  finishReasons?: string[];
  systemFingerprint?: string;
  outputMessages?: Array<{
    role: string;
    content: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool_calls?: any[];
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Extracted text completion attributes
 */
export interface CompletionAttributes {
  responseId?: string;
  responseModel?: string;
  completionText?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Extracts attributes from chat completion response
 *
 * @param response - OpenAI chat completion response
 * @returns Extracted attributes
 */
export function extractChatCompletionAttributes(
  response: OpenAI.Chat.Completions.ChatCompletion
): ChatCompletionAttributes {
  const attrs: ChatCompletionAttributes = {};

  // Response ID
  if (response.id) {
    attrs.responseId = response.id;
  }

  // Response model (actual model used)
  if (response.model) {
    attrs.responseModel = response.model;
  }

  // System fingerprint (OpenAI-specific)
  if (response.system_fingerprint) {
    attrs.systemFingerprint = response.system_fingerprint;
  }

  // Extract finish reasons
  if (response.choices && response.choices.length > 0) {
    attrs.finishReasons = response.choices
      .map((choice) => choice.finish_reason)
      .filter((reason) => reason !== null && reason !== undefined) as string[];
  }

  // Extract output messages
  if (response.choices && response.choices.length > 0) {
    attrs.outputMessages = response.choices.map((choice) => ({
      role: choice.message.role,
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    }));
  }

  // Extract usage metrics
  if (response.usage) {
    attrs.usage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  return attrs;
}

/**
 * Extracts attributes from text completion response
 *
 * @param response - OpenAI completion response
 * @returns Extracted attributes
 */
export function extractCompletionAttributes(
  response: OpenAI.Completions.Completion
): CompletionAttributes {
  const attrs: CompletionAttributes = {};

  if (response.id) {
    attrs.responseId = response.id;
  }

  if (response.model) {
    attrs.responseModel = response.model;
  }

  // Extract completion text
  if (response.choices && response.choices.length > 0) {
    const texts = response.choices.map((choice) => choice.text).filter(Boolean);
    if (texts.length > 0) {
      attrs.completionText = JSON.stringify(texts);
    }
  }

  // Extract usage
  if (response.usage) {
    attrs.usage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  return attrs;
}
