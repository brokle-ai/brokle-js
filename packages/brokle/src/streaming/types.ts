/**
 * Type definitions for streaming chunk formats
 *
 * Supports OpenAI and Anthropic streaming response formats.
 */

/**
 * OpenAI streaming chunk format
 */
export interface OpenAIChunk {
  /** Array of completion choices */
  choices?: Array<{
    /** Delta content for this chunk */
    delta?: {
      /** Text content */
      content?: string;
      /** Role (usually not in delta) */
      role?: string;
      /** Function call data */
      function_call?: {
        name?: string;
        arguments?: string;
      };
      /** Tool calls data */
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    /** Finish reason when streaming completes */
    finish_reason?: string | null;
    /** Choice index */
    index?: number;
  }>;
  /** Model name */
  model?: string;
  /** Token usage (typically in final chunk) */
  usage?: {
    /** Prompt tokens */
    prompt_tokens?: number;
    /** Completion tokens */
    completion_tokens?: number;
    /** Total tokens */
    total_tokens?: number;
  };
  /** Completion ID */
  id?: string;
  /** Object type */
  object?: string;
  /** Creation timestamp */
  created?: number;
}

/**
 * Anthropic streaming chunk format
 */
export interface AnthropicChunk {
  /** Event type */
  type?:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'ping'
    | 'error';
  /** Delta content (for content_block_delta events) */
  delta?: {
    /** Delta type */
    type?: 'text_delta' | 'input_json_delta';
    /** Text content */
    text?: string;
    /** Partial JSON for tool inputs */
    partial_json?: string;
  };
  /** Message object (for message_start events) */
  message?: {
    /** Message ID */
    id?: string;
    /** Message type */
    type?: string;
    /** Role */
    role?: string;
    /** Content blocks */
    content?: Array<unknown>;
    /** Model name */
    model?: string;
    /** Stop reason */
    stop_reason?: string | null;
    /** Stop sequence */
    stop_sequence?: string | null;
    /** Token usage */
    usage?: {
      /** Input tokens */
      input_tokens?: number;
      /** Output tokens */
      output_tokens?: number;
    };
  };
  /** Token usage (for message_delta events) */
  usage?: {
    /** Output tokens */
    output_tokens?: number;
  };
  /** Content block index (for content_block_* events) */
  index?: number;
  /** Content block (for content_block_start events) */
  content_block?: {
    type?: string;
    text?: string;
  };
}

/**
 * Union type for all supported streaming chunk formats
 *
 * Includes OpenAI, Anthropic, and a fallback for custom providers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StreamChunk = OpenAIChunk | AnthropicChunk | Record<string, any>;
