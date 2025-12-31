/**
 * Template Compiler
 *
 * Multi-dialect template compilation for prompts with variable extraction
 * and validation. Supports simple, Mustache, and Jinja2 dialects.
 */

import Mustache from 'mustache';
import nunjucks from 'nunjucks';
import type {
  Template,
  TextTemplate,
  ChatTemplate,
  Variables,
  ChatMessage,
  TemplateDialect,
} from './types';

// Configure nunjucks for safe rendering (no filesystem access)
const nunjucksEnv = nunjucks.configure({ autoescape: false });

// Disable Mustache HTML escaping for prompt templates
Mustache.escape = (text: string) => text;

/**
 * Regex patterns for dialect detection and variable extraction
 */
const PATTERNS = {
  // Simple: {{variable}}
  simple: /\{\{(\w+)\}\}/g,
  // Mustache sections: {{#section}}, {{^inverted}}, {{>partial}}
  mustacheSection: /\{\{[#^>/](\w+)\}\}/,
  // Jinja2 blocks: {% if %}, {% for %}, {{ var|filter }}, {{ var.attr }}
  jinja2Block: /\{%\s*(if|for|else|elif|endif|endfor|block|extends|include|macro|endmacro|set)\b/,
  jinja2Filter: /\{\{\s*\w+\s*\|/,
  jinja2DotNotation: /\{\{\s*\w+\.\w+/,
  // Mustache variable extraction (including sections)
  mustacheVars: /\{\{([#^/]?)(\w+)\}\}/g,
  // Jinja2 variable extraction (captures full dot-notation path)
  jinja2Vars: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)(?:\s*\|[^}]*)?\s*\}\}/g,
  jinja2ForLoop: /\{%\s*for\s+\w+\s+in\s+(\w+)/g,
  jinja2Condition: /\{%\s*(?:if|elif)\s+(\w+)/g,
};

/**
 * Detect the template dialect from content
 *
 * Detection order:
 * 1. Check for Jinja2 markers ({% ... %}, {{ var|filter }}, {{ var.attr }})
 * 2. Check for Mustache markers ({{#...}}, {{^...}}, {{>...}})
 * 3. Default to simple (just {{var}})
 *
 * @param content - Template content string
 * @returns Detected dialect
 */
export function detectDialect(content: string): TemplateDialect {
  // Check for Jinja2 first (more specific syntax)
  if (
    PATTERNS.jinja2Block.test(content) ||
    PATTERNS.jinja2Filter.test(content) ||
    PATTERNS.jinja2DotNotation.test(content)
  ) {
    return 'jinja2';
  }

  // Check for Mustache sections
  if (PATTERNS.mustacheSection.test(content)) {
    return 'mustache';
  }

  // Default to simple
  return 'simple';
}

/**
 * Detect dialect from a template (text or chat)
 *
 * @param template - Template to analyze
 * @returns Detected dialect
 */
export function detectTemplateDialect(template: Template): TemplateDialect {
  if ('content' in template) {
    return detectDialect((template as TextTemplate).content || '');
  }

  if ('messages' in template) {
    const messages = (template as ChatTemplate).messages || [];
    for (const msg of messages) {
      if (msg.content) {
        const dialect = detectDialect(msg.content);
        if (dialect !== 'simple') {
          return dialect;
        }
      }
    }
  }

  return 'simple';
}

/**
 * Extract variables from a string based on dialect
 *
 * @param content - String to extract variables from
 * @param dialect - Template dialect
 * @returns Array of unique variable names
 */
function extractVariablesFromString(content: string, dialect: TemplateDialect): string[] {
  const variables = new Set<string>();

  if (dialect === 'simple') {
    let match;
    while ((match = PATTERNS.simple.exec(content)) !== null) {
      if (match[1]) variables.add(match[1]);
    }
    PATTERNS.simple.lastIndex = 0;
  } else if (dialect === 'mustache') {
    let match;
    while ((match = PATTERNS.mustacheVars.exec(content)) !== null) {
      // match[1] is the prefix (#, ^, /, or empty)
      // match[2] is the variable name
      if (match[2]) variables.add(match[2]);
    }
    PATTERNS.mustacheVars.lastIndex = 0;
  } else if (dialect === 'jinja2') {
    // Extract {{ var }} and {{ var|filter }} and {{ var.attr }}
    let match;
    while ((match = PATTERNS.jinja2Vars.exec(content)) !== null) {
      if (match[1]) {
        const varPath = match[1];
        // Extract root variable from dot-notation path
        const rootVar = varPath.split('.')[0];
        if (rootVar) {
          variables.add(rootVar);
        }
      }
    }
    PATTERNS.jinja2Vars.lastIndex = 0;

    // Extract {% for x in items %}
    while ((match = PATTERNS.jinja2ForLoop.exec(content)) !== null) {
      if (match[1]) variables.add(match[1]);
    }
    PATTERNS.jinja2ForLoop.lastIndex = 0;

    // Extract {% if condition %}
    while ((match = PATTERNS.jinja2Condition.exec(content)) !== null) {
      if (match[1]) variables.add(match[1]);
    }
    PATTERNS.jinja2Condition.lastIndex = 0;
  }

  return Array.from(variables);
}

/**
 * Extract variable names from a template
 *
 * @param template - Template (text or chat)
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Array of unique variable names
 */
export function extractVariables(
  template: Template,
  dialect: TemplateDialect = 'auto'
): string[] {
  const resolvedDialect = dialect === 'auto' ? detectTemplateDialect(template) : dialect;
  const variables = new Set<string>();

  if ('content' in template) {
    const content = (template as TextTemplate).content || '';
    for (const v of extractVariablesFromString(content, resolvedDialect)) {
      variables.add(v);
    }
  } else if ('messages' in template) {
    const messages = (template as ChatTemplate).messages || [];
    for (const msg of messages) {
      if (msg.content) {
        for (const v of extractVariablesFromString(msg.content, resolvedDialect)) {
          variables.add(v);
        }
      }
    }
  }

  return Array.from(variables);
}

/**
 * Compile a string using the specified dialect
 *
 * @param content - String with template syntax
 * @param variables - Variable values
 * @param dialect - Template dialect
 * @returns Compiled string
 */
function compileString(
  content: string,
  variables: Variables,
  dialect: TemplateDialect
): string {
  if (dialect === 'simple') {
    return content.replace(PATTERNS.simple, (match, varName) => {
      if (varName in variables) {
        const value = variables[varName];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      }
      return match; // Preserve unmatched variables
    });
  }

  if (dialect === 'mustache') {
    return Mustache.render(content, variables);
  }

  if (dialect === 'jinja2') {
    return nunjucksEnv.renderString(content, variables);
  }

  // Fallback to simple
  return compileString(content, variables, 'simple');
}

/**
 * Compile a text template
 *
 * @param template - Text template
 * @param variables - Variable values
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Compiled text template
 */
export function compileTextTemplate(
  template: TextTemplate,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): TextTemplate {
  const resolvedDialect = dialect === 'auto' ? detectDialect(template.content || '') : dialect;
  return {
    content: compileString(template.content || '', variables, resolvedDialect),
  };
}

/**
 * Compile a chat message
 *
 * @param message - Chat message
 * @param variables - Variable values
 * @param dialect - Template dialect
 * @returns Compiled chat message
 */
function compileChatMessage(
  message: ChatMessage,
  variables: Variables,
  dialect: TemplateDialect
): ChatMessage {
  return {
    ...message,
    content: compileString(message.content, variables, dialect),
  };
}

/**
 * Compile a chat template with support for placeholders
 *
 * Placeholders allow injecting conversation history:
 * - Message with type: "placeholder" and name: "history"
 * - Variables include history: [{role: "user", content: "Hi"}, ...]
 * - Placeholder is replaced with the array of messages
 *
 * @param template - Chat template
 * @param variables - Variable values (may include arrays for placeholders)
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Compiled chat template
 */
export function compileChatTemplate(
  template: ChatTemplate,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): ChatTemplate {
  const resolvedDialect =
    dialect === 'auto' ? detectTemplateDialect(template) : dialect;
  const result: ChatMessage[] = [];

  for (const msg of template.messages || []) {
    // Handle placeholder messages (for history injection)
    if (msg.type === 'placeholder' && msg.name) {
      const placeholderName = msg.name;
      const placeholderValue = variables[placeholderName];

      if (Array.isArray(placeholderValue)) {
        // Inject messages from the array
        for (const item of placeholderValue) {
          if (
            typeof item === 'object' &&
            item !== null &&
            'role' in item &&
            'content' in item
          ) {
            result.push({
              role: (item as Record<string, unknown>).role as ChatMessage['role'],
              content: String((item as Record<string, unknown>).content),
              name: (item as Record<string, unknown>).name as string | undefined,
              tool_call_id: (item as Record<string, unknown>).tool_call_id as
                | string
                | undefined,
            });
          }
        }
      }
      // Skip placeholder if value is not an array
      continue;
    }

    // Regular message - compile content
    result.push(compileChatMessage(msg, variables, resolvedDialect));
  }

  return { messages: result };
}

/**
 * Compile any template type
 *
 * @param template - Template (text or chat)
 * @param variables - Variable values
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Compiled template of the same type
 */
export function compileTemplate(
  template: Template,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): Template {
  if ('content' in template) {
    return compileTextTemplate(template as TextTemplate, variables, dialect);
  }
  return compileChatTemplate(template as ChatTemplate, variables, dialect);
}

/**
 * Validate that all required variables are provided
 *
 * @param template - Template with variables
 * @param variables - Provided variables
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Object with missing variables array and isValid boolean
 */
export function validateVariables(
  template: Template,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): { missing: string[]; isValid: boolean } {
  const required = extractVariables(template, dialect);
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
 *
 * @param template - Text template
 * @param variables - Variable values
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Compiled content string
 */
export function getCompiledContent(
  template: TextTemplate,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): string {
  return compileTextTemplate(template, variables, dialect).content;
}

/**
 * Get the messages array from a chat template after compilation
 *
 * @param template - Chat template
 * @param variables - Variable values
 * @param dialect - Template dialect (auto-detected if not specified)
 * @returns Compiled messages array
 */
export function getCompiledMessages(
  template: ChatTemplate,
  variables: Variables,
  dialect: TemplateDialect = 'auto'
): ChatMessage[] {
  return compileChatTemplate(template, variables, dialect).messages;
}
