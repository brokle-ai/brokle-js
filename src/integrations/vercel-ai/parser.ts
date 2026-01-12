/**
 * Attribute Extraction from Vercel AI SDK Responses
 *
 * Parses Vercel AI SDK responses to extract GenAI semantic convention attributes.
 * Supports generateText, streamText, generateObject, streamObject, embed, embedMany.
 */

/**
 * Extracted response attributes from Vercel AI SDK
 */
export interface VercelAIResponseAttributes {
  /** Response ID from the provider */
  responseId?: string;
  /** Actual model used for generation */
  responseModel?: string;
  /** Reason why generation finished */
  finishReason?: string;
  /** Token usage metrics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
}

/**
 * Extracted embedding attributes
 */
export interface VercelAIEmbedAttributes {
  /** Response model used */
  responseModel?: string;
  /** Token usage for embeddings */
  usage?: {
    inputTokens: number;
  };
  /** Number of embeddings generated */
  embeddingCount?: number;
}

/**
 * Extracts attributes from generateText response
 *
 * @param result - Result from generateText()
 * @returns Extracted attributes for span
 */
export function extractGenerateTextAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): VercelAIResponseAttributes {
  const attrs: VercelAIResponseAttributes = {};

  if (!result) return attrs;

  // Response metadata
  if (result.response?.id) {
    attrs.responseId = result.response.id;
  }
  if (result.response?.modelId) {
    attrs.responseModel = result.response.modelId;
  }

  // Finish reason
  if (result.finishReason) {
    attrs.finishReason = result.finishReason;
  }

  // Usage metrics
  if (result.usage) {
    attrs.usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
    };

    // Optional reasoning tokens (for models that support it)
    if (result.usage.reasoningTokens !== undefined) {
      attrs.usage.reasoningTokens = result.usage.reasoningTokens;
    }
  }

  return attrs;
}

/**
 * Extracts attributes from generateObject response
 * Same structure as generateText
 *
 * @param result - Result from generateObject()
 * @returns Extracted attributes for span
 */
export function extractGenerateObjectAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): VercelAIResponseAttributes {
  // generateObject has same response structure as generateText
  return extractGenerateTextAttributes(result);
}

/**
 * Extracts attributes from resolved streaming usage
 * For streamText/streamObject, usage is available after stream consumption
 *
 * @param usage - Resolved usage object from stream
 * @param finishReason - Resolved finish reason from stream
 * @param response - Resolved response metadata
 * @returns Extracted attributes for span
 */
export function extractStreamAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  usage?: any,
  finishReason?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response?: any
): VercelAIResponseAttributes {
  const attrs: VercelAIResponseAttributes = {};

  // Response metadata
  if (response?.id) {
    attrs.responseId = response.id;
  }
  if (response?.modelId) {
    attrs.responseModel = response.modelId;
  }

  // Finish reason
  if (finishReason) {
    attrs.finishReason = finishReason;
  }

  // Usage metrics
  if (usage) {
    attrs.usage = {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    };

    if (usage.reasoningTokens !== undefined) {
      attrs.usage.reasoningTokens = usage.reasoningTokens;
    }
  }

  return attrs;
}

/**
 * Extracts attributes from embed response
 *
 * @param result - Result from embed()
 * @returns Extracted embedding attributes
 */
export function extractEmbedAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): VercelAIEmbedAttributes {
  const attrs: VercelAIEmbedAttributes = {};

  if (!result) return attrs;

  // Response model
  if (result.response?.modelId) {
    attrs.responseModel = result.response.modelId;
  }

  // Usage (embeddings only have input tokens)
  if (result.usage?.inputTokens !== undefined) {
    attrs.usage = {
      inputTokens: result.usage.inputTokens,
    };
  }

  // Single embedding
  attrs.embeddingCount = 1;

  return attrs;
}

/**
 * Extracts attributes from embedMany response
 *
 * @param result - Result from embedMany()
 * @returns Extracted embedding attributes
 */
export function extractEmbedManyAttributes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): VercelAIEmbedAttributes {
  const attrs: VercelAIEmbedAttributes = {};

  if (!result) return attrs;

  // Response model
  if (result.response?.modelId) {
    attrs.responseModel = result.response.modelId;
  }

  // Usage
  if (result.usage?.inputTokens !== undefined) {
    attrs.usage = {
      inputTokens: result.usage.inputTokens,
    };
  }

  // Count embeddings
  if (result.embeddings && Array.isArray(result.embeddings)) {
    attrs.embeddingCount = result.embeddings.length;
  }

  return attrs;
}
