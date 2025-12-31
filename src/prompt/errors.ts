/**
 * Prompt-specific exceptions
 *
 * These exceptions provide structured error handling for prompt operations
 * with consistent error codes and status codes for API compatibility.
 */

/**
 * Base error class for prompt operations
 *
 * All prompt-related exceptions inherit from this class, providing
 * consistent error handling with error codes and optional HTTP status codes.
 */
export class PromptError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'PromptError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, PromptError.prototype);
  }

  toString(): string {
    if (this.statusCode) {
      return `[${this.code}] ${this.message} (HTTP ${this.statusCode})`;
    }
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Raised when a prompt is not found
 *
 * This exception is raised when attempting to fetch a prompt that
 * doesn't exist or when the specified version/label is not available.
 */
export class PromptNotFoundError extends PromptError {
  private promptName: string;
  public readonly version?: number;
  public readonly label?: string;

  constructor(
    name: string,
    options?: { version?: number; label?: string }
  ) {
    const target = options?.version
      ? `version ${options.version}`
      : options?.label
      ? `label "${options.label}"`
      : 'latest';

    super(`Prompt "${name}" not found (${target})`, 'PROMPT_NOT_FOUND', 404);
    this.name = 'PromptNotFoundError';
    this.promptName = name;
    this.version = options?.version;
    this.label = options?.label;

    Object.setPrototypeOf(this, PromptNotFoundError.prototype);
  }

  /**
   * Get the prompt name (separate method to avoid conflict with Error.name)
   */
  getPromptName(): string {
    return this.promptName;
  }
}

/**
 * Raised when prompt compilation fails
 *
 * This exception is raised when template compilation fails,
 * typically due to missing required variables.
 */
export class PromptCompileError extends PromptError {
  public readonly missingVariables: string[];

  constructor(message: string, missingVariables: string[] = []) {
    super(message, 'PROMPT_COMPILE_ERROR');
    this.name = 'PromptCompileError';
    this.missingVariables = missingVariables;

    Object.setPrototypeOf(this, PromptCompileError.prototype);
  }
}

/**
 * Raised when fetching a prompt fails
 *
 * This exception is raised when an HTTP request to fetch a prompt
 * fails due to network issues, server errors, or other problems.
 */
export class PromptFetchError extends PromptError {
  constructor(message: string, statusCode?: number) {
    super(message, 'PROMPT_FETCH_ERROR', statusCode);
    this.name = 'PromptFetchError';

    Object.setPrototypeOf(this, PromptFetchError.prototype);
  }
}
