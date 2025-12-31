/**
 * Attribute Extraction from Anthropic Responses
 *
 * Parses Anthropic API responses to extract GenAI semantic convention attributes
 */

import type Anthropic from '@anthropic-ai/sdk';

/**
 * Extracted message attributes
 */
export interface MessageAttributes {
  responseId?: string;
  responseModel?: string;
  stopReason?: string;
  outputContent?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Extracts attributes from Anthropic message response
 *
 * @param response - Anthropic message response
 * @returns Extracted attributes
 */
export function extractMessageAttributes(
  response: Anthropic.Messages.Message
): MessageAttributes {
  const attrs: MessageAttributes = {};

  // Response ID
  if (response.id) {
    attrs.responseId = response.id;
  }

  // Response model (actual model used)
  if (response.model) {
    attrs.responseModel = response.model;
  }

  // Stop reason
  if (response.stop_reason) {
    attrs.stopReason = response.stop_reason;
  }

  // Extract output content
  if (response.content && response.content.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textContents = response.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text);

    if (textContents.length > 0) {
      attrs.outputContent = textContents.join('\n');
    }
  }

  // Extract usage metrics
  if (response.usage) {
    attrs.usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  return attrs;
}
