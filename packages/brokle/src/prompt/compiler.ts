/**
 * Template Compiler
 *
 * Mustache-style template compilation for prompts with variable extraction
 * and validation.
 */

import type { Template, TextTemplate, ChatTemplate, Variables, ChatMessage } from './types';

/**
 * Variable pattern matching {{variable_name}}
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Extract variable names from a template
 *
 * @param template - Template (text or chat)
 * @returns Array of unique variable names
 */
export function extractVariables(template: Template): string[] {
  const variables = new Set<string>();

  if ('content' in template) {
    const content = (template as TextTemplate).content || '';
    let match;
    while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
      if (match[1]) variables.add(match[1]);
    }
    VARIABLE_PATTERN.lastIndex = 0;
  } else if ('messages' in template) {
    const messages = (template as ChatTemplate).messages || [];
    for (const msg of messages) {
      if (msg.content) {
        let match;
        while ((match = VARIABLE_PATTERN.exec(msg.content)) !== null) {
          if (match[1]) variables.add(match[1]);
        }
        VARIABLE_PATTERN.lastIndex = 0;
      }
    }
  }

  return Array.from(variables);
}

/**
 * Compile a string by replacing variables
 *
 * @param content - String with {{variable}} placeholders
 * @param variables - Variable values
 * @returns Compiled string
 */
function compileString(content: string, variables: Variables): string {
  return content.replace(VARIABLE_PATTERN, (match, varName) => {
    if (varName in variables) {
      return String(variables[varName]);
    }
    return match;
  });
}

/**
 * Compile a text template
 *
 * @param template - Text template
 * @param variables - Variable values
 * @returns Compiled text template
 */
export function compileTextTemplate(
  template: TextTemplate,
  variables: Variables
): TextTemplate {
  return {
    content: compileString(template.content, variables),
  };
}

/**
 * Compile a chat message
 *
 * @param message - Chat message
 * @param variables - Variable values
 * @returns Compiled chat message
 */
function compileChatMessage(
  message: ChatMessage,
  variables: Variables
): ChatMessage {
  return {
    ...message,
    content: compileString(message.content, variables),
  };
}

/**
 * Compile a chat template
 *
 * @param template - Chat template
 * @param variables - Variable values
 * @returns Compiled chat template
 */
export function compileChatTemplate(
  template: ChatTemplate,
  variables: Variables
): ChatTemplate {
  return {
    messages: template.messages.map((msg) => compileChatMessage(msg, variables)),
  };
}

/**
 * Compile any template type
 *
 * @param template - Template (text or chat)
 * @param variables - Variable values
 * @returns Compiled template of the same type
 */
export function compileTemplate(
  template: Template,
  variables: Variables
): Template {
  if ('content' in template) {
    return compileTextTemplate(template as TextTemplate, variables);
  }
  return compileChatTemplate(template as ChatTemplate, variables);
}

/**
 * Validate that all required variables are provided
 *
 * @param template - Template with variables
 * @param variables - Provided variables
 * @returns Object with missing variables array and isValid boolean
 */
export function validateVariables(
  template: Template,
  variables: Variables
): { missing: string[]; isValid: boolean } {
  const required = extractVariables(template);
  const provided = new Set(Object.keys(variables));
  const missing = required.filter((v) => !provided.has(v));

  return {
    missing,
    isValid: missing.length === 0,
  };
}

/**
 * Check if a template is a text template
 */
export function isTextTemplate(template: Template): template is TextTemplate {
  return 'content' in template;
}

/**
 * Check if a template is a chat template
 */
export function isChatTemplate(template: Template): template is ChatTemplate {
  return 'messages' in template;
}

/**
 * Get the content string from a text template after compilation
 */
export function getCompiledContent(
  template: TextTemplate,
  variables: Variables
): string {
  return compileTextTemplate(template, variables).content;
}

/**
 * Get the messages array from a chat template after compilation
 */
export function getCompiledMessages(
  template: ChatTemplate,
  variables: Variables
): ChatMessage[] {
  return compileChatTemplate(template, variables).messages;
}
