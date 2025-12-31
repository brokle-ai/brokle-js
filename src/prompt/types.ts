/**
 * Prompt Management Types
 *
 * TypeScript interfaces for the Brokle Prompt Management system.
 */

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

/**
 * Prompt type - text for simple templates, chat for message arrays
 */
export type PromptType = 'text' | 'chat';

/**
 * Template dialect for rendering
 *
 * - `simple`: Basic {{variable}} substitution only
 * - `mustache`: Full Mustache support with sections, loops, partials
 * - `jinja2`: Jinja2/Nunjucks with filters, conditionals, loops
 * - `auto`: Auto-detect dialect from template syntax
 */
export type TemplateDialect = 'simple' | 'mustache' | 'jinja2' | 'auto';

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
  /** Message type - 'placeholder' for history injection */
  type?: 'placeholder' | string;
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
  /** Template dialect (simple, mustache, jinja2) */
  dialect?: TemplateDialect;
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
  /** Template dialect (simple, mustache, jinja2) */
  dialect?: TemplateDialect;
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
  /**
   * Fallback content if fetch fails
   *
   * Type is auto-detected:
   * - String → TEXT prompt
   * - Array of messages → CHAT prompt
   *
   * @example
   * ```typescript
   * // Text fallback
   * const prompt = await manager.get("greeting", {
   *   fallback: "Hello {{name}}!"
   * });
   *
   * // Chat fallback
   * const prompt = await manager.get("assistant", {
   *   fallback: [{ role: "system", content: "You are helpful." }]
   * });
   * ```
   */
  fallback?: Fallback;
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
 * A single variable value - primitives, arrays, or objects
 */
export type VariableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | VariableValue[]
  | { [key: string]: VariableValue };

/**
 * Variables object for template compilation
 *
 * Supports:
 * - Primitives: string, number, boolean
 * - Arrays: for Mustache sections ({{#items}}...{{/items}}) or history injection
 * - Objects: for nested access ({{user.name}})
 *
 * @example
 * ```typescript
 * const variables: Variables = {
 *   name: "Alice",
 *   count: 42,
 *   premium: true,
 *   // Array for Mustache loop or history injection
 *   history: [
 *     { role: "user", content: "Hello" },
 *     { role: "assistant", content: "Hi there!" }
 *   ],
 *   // Nested object
 *   user: { name: "Alice", email: "alice@example.com" }
 * };
 * ```
 */
export type Variables = Record<string, VariableValue>;

/**
 * Text fallback - a simple string template
 *
 * @example
 * ```typescript
 * const fallback: TextFallback = "Hello {{name}}!";
 * ```
 */
export type TextFallback = string;

/**
 * Chat fallback - an array of chat messages
 *
 * @example
 * ```typescript
 * const fallback: ChatFallback = [
 *   { role: "system", content: "You are helpful." },
 *   { role: "user", content: "{{query}}" }
 * ];
 * ```
 */
export type ChatFallback = ChatMessage[];

/**
 * Fallback type - string for text prompts, array for chat prompts
 *
 * Type is auto-detected:
 * - String → TEXT prompt
 * - Array → CHAT prompt
 *
 * @example
 * ```typescript
 * // Text fallback
 * const prompt = await manager.get("greeting", {
 *   fallback: "Hello {{name}}!"
 * });
 *
 * // Chat fallback
 * const prompt = await manager.get("assistant", {
 *   fallback: [
 *     { role: "system", content: "You are helpful." },
 *     { role: "user", content: "{{query}}" }
 *   ]
 * });
 * ```
 */
export type Fallback = TextFallback | ChatFallback;

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
