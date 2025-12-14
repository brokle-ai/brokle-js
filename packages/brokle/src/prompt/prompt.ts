/**
 * Prompt Class
 *
 * Represents a fetched prompt with methods for compilation and
 * conversion to various LLM provider formats.
 */

import type {
  PromptData,
  PromptType,
  Template,
  ChatTemplate,
  TextTemplate,
  ModelConfig,
  Variables,
  OpenAIMessage,
  AnthropicMessage,
  AnthropicRequest,
} from './types';
import {
  compileTemplate,
  compileTextTemplate,
  extractVariables,
  validateVariables,
  isTextTemplate,
} from './compiler';
import { PromptCompileError } from './errors';

/**
 * Prompt class with compilation and provider conversion methods
 */
export class Prompt {
  readonly id: string;
  readonly name: string;
  readonly type: PromptType;
  readonly description: string;
  readonly tags: string[];
  readonly template: Template;
  readonly config: ModelConfig | null;
  readonly variables: string[];
  readonly labels: string[];
  readonly version: number;
  readonly isFallback: boolean;
  readonly commitMessage: string;
  readonly createdAt: string;

  constructor(data: PromptData) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.description = data.description;
    this.tags = data.tags;
    this.template = data.template;
    this.config = data.config;
    this.variables = data.variables;
    this.labels = data.labels;
    this.version = data.version;
    this.isFallback = data.is_fallback;
    this.commitMessage = data.commit_message;
    this.createdAt = data.created_at;
  }

  /**
   * Compile the template with provided variables
   *
   * @param variables - Variable values for interpolation
   * @returns Compiled template
   * @throws PromptCompileError if required variables are missing
   */
  compile(variables: Variables = {}): Template {
    const validation = validateVariables(this.template, variables);
    if (!validation.isValid) {
      throw new PromptCompileError(
        `Missing required variables: ${validation.missing.join(', ')}`,
        validation.missing
      );
    }
    return compileTemplate(this.template, variables);
  }

  /**
   * Get the compiled content as a string (text templates only)
   *
   * @param variables - Variable values for interpolation
   * @returns Compiled content string
   * @throws PromptCompileError if prompt is not a text template or variables are missing
   */
  compileText(variables: Variables = {}): string {
    if (!isTextTemplate(this.template)) {
      throw new PromptCompileError('compileText() can only be used with text templates');
    }
    const validation = validateVariables(this.template, variables);
    if (!validation.isValid) {
      throw new PromptCompileError(
        `Missing required variables: ${validation.missing.join(', ')}`,
        validation.missing
      );
    }
    return compileTextTemplate(this.template, variables).content;
  }

  /**
   * Get the raw template without compilation
   *
   * @returns The raw template (TextTemplate or ChatTemplate)
   */
  getRawTemplate(): Template {
    return this.template;
  }

  /**
   * Convert to LangChain prompt template
   *
   * Requires @langchain/core to be installed.
   *
   * @returns LangChain PromptTemplate or ChatPromptTemplate
   * @throws Error if @langchain/core is not installed
   */
  toLangChain(): any {
    try {
      // Dynamic import to avoid requiring langchain as dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ChatPromptTemplate, PromptTemplate } = require('@langchain/core/prompts');

      if (this.isText()) {
        // Text template -> convert {{var}} to {var} for LangChain
        const content = (this.template as TextTemplate).content.replace(
          /\{\{(\w+)\}\}/g,
          '{$1}'
        );
        return PromptTemplate.fromTemplate(content);
      }

      const messages = (this.template as ChatTemplate).messages;
      const langchainMessages = messages.map((msg) => {
        const content = msg.content.replace(/\{\{(\w+)\}\}/g, '{$1}');

        switch (msg.role) {
          case 'system':
            return ['system', content] as const;
          case 'user':
            return ['human', content] as const;
          case 'assistant':
            return ['ai', content] as const;
          default:
            return ['human', content] as const;
        }
      });

      return ChatPromptTemplate.fromMessages(langchainMessages);
    } catch (error) {
      throw new Error(
        '@langchain/core is required for toLangChain(). ' +
          'Install with: npm install @langchain/core'
      );
    }
  }

  /**
   * Convert to LlamaIndex prompt template
   *
   * Requires llamaindex to be installed.
   *
   * @returns LlamaIndex PromptTemplate or ChatPromptTemplate
   * @throws Error if llamaindex is not installed
   */
  toLlamaIndex(): any {
    try {
      // Dynamic import to avoid requiring llamaindex as dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        PromptTemplate,
        ChatPromptTemplate,
        ChatMessage: LlamaMessage,
        MessageRole,
      } = require('llamaindex');

      if (this.isText()) {
        return new PromptTemplate({
          template: (this.template as TextTemplate).content,
        });
      }

      // Chat template -> map to LlamaIndex messages
      const messages = (this.template as ChatTemplate).messages;
      const llamaMessages = messages.map((msg) => {
        let role = MessageRole.USER;
        switch (msg.role) {
          case 'system':
            role = MessageRole.SYSTEM;
            break;
          case 'user':
            role = MessageRole.USER;
            break;
          case 'assistant':
            role = MessageRole.ASSISTANT;
            break;
        }

        return new LlamaMessage({ role, content: msg.content });
      });

      return new ChatPromptTemplate({ messageTemplates: llamaMessages });
    } catch (error) {
      throw new Error(
        'llamaindex is required for toLlamaIndex(). ' +
          'Install with: npm install llamaindex'
      );
    }
  }

  /**
   * Convert to OpenAI messages format
   *
   * For text templates, returns a single user message.
   * For chat templates, maps messages directly.
   *
   * @param variables - Variable values for interpolation
   * @returns OpenAI-compatible messages array
   */
  toOpenAIMessages(variables: Variables = {}): OpenAIMessage[] {
    const compiled = this.compile(variables);

    if (isTextTemplate(compiled)) {
      return [
        {
          role: 'user',
          content: compiled.content,
        },
      ];
    }

    const messages = (compiled as ChatTemplate).messages;
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name }),
      ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
    }));
  }

  /**
   * Convert to Anthropic messages format
   *
   * Anthropic requires system messages to be separate.
   * Returns an object with system prompt and messages array.
   *
   * @param variables - Variable values for interpolation
   * @returns Anthropic-compatible request structure
   */
  toAnthropicMessages(variables: Variables = {}): AnthropicRequest {
    const compiled = this.compile(variables);

    if (isTextTemplate(compiled)) {
      return {
        messages: [
          {
            role: 'user',
            content: compiled.content,
          },
        ],
      };
    }

    const messages = (compiled as ChatTemplate).messages;
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

    const anthropicMessages: AnthropicMessage[] = otherMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    return {
      ...(systemPrompt && { system: systemPrompt }),
      messages: anthropicMessages,
    };
  }

  /**
   * Get model configuration with optional overrides
   *
   * @param overrides - Optional config overrides
   * @returns Merged model config
   */
  getModelConfig(overrides?: Partial<ModelConfig>): ModelConfig {
    return {
      ...this.config,
      ...overrides,
    };
  }

  /**
   * Check if a variable is required
   *
   * @param variableName - Variable name to check
   * @returns true if variable is in the template
   */
  hasVariable(variableName: string): boolean {
    return this.variables.includes(variableName);
  }

  /**
   * Get missing variables for a given set of values
   *
   * @param variables - Provided variable values
   * @returns Array of missing variable names
   */
  getMissingVariables(variables: Variables): string[] {
    return validateVariables(this.template, variables).missing;
  }

  /**
   * Check if all required variables are provided
   *
   * @param variables - Provided variable values
   * @returns true if all variables are provided
   */
  validateVariables(variables: Variables): boolean {
    return validateVariables(this.template, variables).isValid;
  }

  /**
   * Check if this is a text template
   */
  isText(): boolean {
    return this.type === 'text';
  }

  /**
   * Check if this is a chat template
   */
  isChat(): boolean {
    return this.type === 'chat';
  }

  /**
   * Get a formatted string representation
   */
  toString(): string {
    return `Prompt(${this.name} v${this.version} [${this.type}])`;
  }

  /**
   * Create a Prompt from raw API response data
   */
  static fromData(data: PromptData): Prompt {
    return new Prompt(data);
  }

  /**
   * Create a fallback Prompt when fetch fails
   */
  static createFallback(
    name: string,
    template: Template,
    type: PromptType,
    config?: ModelConfig
  ): Prompt {
    return new Prompt({
      id: 'fallback',
      project_id: '',
      name,
      type,
      description: 'Fallback prompt',
      tags: [],
      template,
      config: config || null,
      variables: extractVariables(template),
      labels: [],
      version: 0,
      is_fallback: true,
      commit_message: '',
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}
