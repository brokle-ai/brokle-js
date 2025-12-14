/**
 * Prompt Management Types
 *
 * TypeScript interfaces for the Brokle Prompt Management system.
 */

// ============================================================================
// API Response Envelope Types
// ============================================================================

/**
 * API response envelope structure
 *
 * All Brokle API responses are wrapped in this envelope format.
 */
export interface APIResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** The response data (only present on success) */
  data?: T;
  /** Error details (only present on failure) */
  error?: APIError;
  /** Request metadata */
  meta?: APIMeta;
}

/**
 * API error structure
 */
export interface APIError {
  /** Error code (e.g., 'not_found', 'validation_error') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: string;
  /** Error type for categorization */
  type: string;
}

/**
 * API response metadata
 */
export interface APIMeta {
  /** Unique request identifier for debugging */
  request_id?: string;
  /** Response timestamp */
  timestamp?: string;
  /** API version */
  version?: string;
  /** Pagination info for list endpoints */
  pagination?: APIPagination;
}

/**
 * Pagination metadata for list responses
 */
export interface APIPagination {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  total_pages: number;
  /** Whether there is a next page */
  has_next: boolean;
  /** Whether there is a previous page */
  has_prev: boolean;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Prompt type - text for simple templates, chat for message arrays
 */
export type PromptType = 'text' | 'chat';

/**
 * Message role in a chat template
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * Text template structure
 */
export interface TextTemplate {
  content: string;
}

/**
 * Chat template structure
 */
export interface ChatTemplate {
  messages: ChatMessage[];
}

/**
 * Template can be either text or chat
 */
export type Template = TextTemplate | ChatTemplate;

/**
 * Model configuration for LLM execution
 */
export interface ModelConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
}

/**
 * Prompt version data
 */
export interface PromptVersion {
  id: string;
  prompt_id: string;
  version: number;
  template: Template;
  config: ModelConfig | null;
  variables: string[];
  labels: string[];
  commit_message: string;
  created_by: string;
  created_at: string;
}

/**
 * Full prompt data
 */
export interface PromptData {
  id: string;
  project_id: string;
  name: string;
  type: PromptType;
  description: string;
  tags: string[];
  template: Template;
  config: ModelConfig | null;
  variables: string[];
  labels: string[];
  version: number;
  is_fallback: boolean;
  commit_message: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Options for fetching a prompt
 */
export interface GetPromptOptions {
  /** Fetch by label (e.g., 'production', 'staging') */
  label?: string;
  /** Fetch by specific version number */
  version?: number;
  /** Cache TTL in seconds (default: 60) */
  cacheTTL?: number;
  /** Force refresh from API, ignoring cache */
  forceRefresh?: boolean;
}

/**
 * Options for listing prompts
 */
export interface ListPromptsOptions {
  /** Filter by prompt type */
  type?: PromptType;
  /** Filter by tags */
  tags?: string[];
  /** Search in name and description */
  search?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Paginated response for prompt lists
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Request to create or update a prompt
 */
export interface UpsertPromptRequest {
  /** Prompt name (unique per project) */
  name: string;
  /** Prompt type */
  type: PromptType;
  /** Prompt description */
  description?: string;
  /** Tags for organization */
  tags?: string[];
  /** Template content */
  template: Template;
  /** Model configuration */
  config?: ModelConfig;
  /** Commit message for versioning */
  commit_message?: string;
  /** Labels to apply to this version */
  labels?: string[];
}

/**
 * Cache entry for prompts
 */
export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

/**
 * OpenAI message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic request structure with system prompt
 */
export interface AnthropicRequest {
  system?: string;
  messages: AnthropicMessage[];
}

/**
 * Variables object for template compilation
 */
export type Variables = Record<string, string | number | boolean>;

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /** Default template to use if fetch fails */
  template: Template;
  /** Prompt type for fallback */
  type: PromptType;
  /** Default model config */
  config?: ModelConfig;
}

/**
 * Prompt client configuration
 *
 * Controls caching behavior and retry settings for prompt operations.
 */
export interface PromptConfig {
  /** Enable caching (default: true) */
  cacheEnabled?: boolean;

  /** Cache TTL in seconds (default: 60) */
  cacheTtlSeconds?: number;

  /** Maximum cache entries (default: 1000) */
  cacheMaxSize?: number;

  /** Number of retries on failure (default: 2) */
  maxRetries?: number;

  /** Base retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}
