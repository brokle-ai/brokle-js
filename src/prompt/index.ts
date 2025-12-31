/**
 * Prompt Management Module
 *
 * Centralized prompt storage with versioning, labels, and caching.
 *
 * @example
 * ```typescript
 * import { PromptManager, Prompt } from 'brokle/prompt';
 *
 * const manager = new PromptManager({
 *   apiKey: 'bk_...',
 *   baseUrl: 'https://api.brokle.ai'
 * });
 *
 * // Fetch a prompt
 * const prompt = await manager.get("greeting", { label: "production" });
 *
 * // Compile with variables
 * const compiled = prompt.compile({ name: "Alice" });
 *
 * // Convert to OpenAI format
 * const messages = prompt.toOpenAIMessages({ name: "Alice" });
 * ```
 *
 * @packageDocumentation
 */

export { Prompt } from './prompt';
export { PromptManager, type PromptManagerConfig } from './manager';
export { PromptCache, type CacheOptions } from './cache';

export {
  PromptError,
  PromptNotFoundError,
  PromptCompileError,
  PromptFetchError,
} from './errors';

export {
  extractVariables,
  compileTemplate,
  compileTextTemplate,
  compileChatTemplate,
  validateVariables,
  isTextTemplate,
  isChatTemplate,
  getCompiledContent,
  getCompiledMessages,
  detectDialect,
  detectTemplateDialect,
} from './compiler';

export type {
  PromptType,
  TemplateDialect,
  MessageRole,
  ChatMessage,
  TextTemplate,
  ChatTemplate,
  Template,
  ModelConfig,
  PromptConfig,
  PromptVersion,
  PromptData,
  GetPromptOptions,
  ListPromptsOptions,
  PaginatedResponse,
  UpsertPromptRequest,
  CacheEntry,
  OpenAIMessage,
  AnthropicMessage,
  AnthropicRequest,
  Variables,
  VariableValue,
  Fallback,
  TextFallback,
  ChatFallback,
} from './types';
