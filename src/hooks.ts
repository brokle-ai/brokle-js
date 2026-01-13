/**
 * Integration Hook Registry System
 *
 * Provides a centralized system for registering and executing hooks
 * at various points in the integration lifecycle.
 */

import type { Span } from '@opentelemetry/api';

/**
 * Hook context passed to hook handlers
 */
export interface HookContext {
  /** The name of the integration triggering the hook */
  integrationName: string;
  /** The operation being performed */
  operation: string;
  /** The active span, if any */
  span?: Span;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request hook context - before an LLM call
 */
export interface RequestHookContext extends HookContext {
  /** Request parameters */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: Record<string, any>;
  /** Model being called */
  model?: string;
}

/**
 * Response hook context - after an LLM call
 */
export interface ResponseHookContext extends HookContext {
  /** The response from the LLM */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any;
  /** Request parameters */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: Record<string, any>;
  /** Duration in milliseconds */
  durationMs: number;
  /** Token usage if available */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Error hook context - when an error occurs
 */
export interface ErrorHookContext extends HookContext {
  /** The error that occurred */
  error: Error;
  /** Request parameters */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: Record<string, any>;
}

/**
 * Streaming hook context - for streaming operations
 */
export interface StreamHookContext extends HookContext {
  /** The chunk of data */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunk: any;
  /** Whether this is the first chunk */
  isFirst: boolean;
  /** Whether this is the last chunk */
  isLast: boolean;
}

/**
 * Hook handler type definitions
 */
export type RequestHook = (ctx: RequestHookContext) => void | Promise<void>;
export type ResponseHook = (ctx: ResponseHookContext) => void | Promise<void>;
export type ErrorHook = (ctx: ErrorHookContext) => void | Promise<void>;
export type StreamHook = (ctx: StreamHookContext) => void | Promise<void>;

/**
 * All hook types
 */
export type HookType = 'request' | 'response' | 'error' | 'stream';

/**
 * Hook handler union type
 */
export type HookHandler = RequestHook | ResponseHook | ErrorHook | StreamHook;

/**
 * Registered hook entry
 */
interface RegisteredHook {
  /** Unique identifier for the hook */
  id: string;
  /** Hook type */
  type: HookType;
  /** Handler function */
  handler: HookHandler;
  /** Priority (lower runs first) */
  priority: number;
  /** Integration filter (optional) */
  integrationFilter?: string | string[];
}

/**
 * Hook registration options
 */
export interface HookRegistrationOptions {
  /** Priority (lower runs first, default: 100) */
  priority?: number;
  /** Only run for specific integrations */
  integrationFilter?: string | string[];
}

/**
 * Hook Registry - manages integration lifecycle hooks
 */
export class HookRegistry {
  private hooks: Map<HookType, RegisteredHook[]> = new Map();
  private hookCounter = 0;

  constructor() {
    this.hooks.set('request', []);
    this.hooks.set('response', []);
    this.hooks.set('error', []);
    this.hooks.set('stream', []);
  }

  /**
   * Register a request hook
   */
  onRequest(handler: RequestHook, options?: HookRegistrationOptions): string {
    return this.register('request', handler, options);
  }

  /**
   * Register a response hook
   */
  onResponse(handler: ResponseHook, options?: HookRegistrationOptions): string {
    return this.register('response', handler, options);
  }

  /**
   * Register an error hook
   */
  onError(handler: ErrorHook, options?: HookRegistrationOptions): string {
    return this.register('error', handler, options);
  }

  /**
   * Register a stream hook
   */
  onStream(handler: StreamHook, options?: HookRegistrationOptions): string {
    return this.register('stream', handler, options);
  }

  /**
   * Register a hook
   */
  private register(
    type: HookType,
    handler: HookHandler,
    options?: HookRegistrationOptions
  ): string {
    const id = `hook_${++this.hookCounter}`;
    const priority = options?.priority ?? 100;

    const hook: RegisteredHook = {
      id,
      type,
      handler,
      priority,
      integrationFilter: options?.integrationFilter,
    };

    const hooks = this.hooks.get(type) || [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(type, hooks);

    return id;
  }

  /**
   * Unregister a hook by ID
   */
  unregister(hookId: string): boolean {
    for (const [type, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex((h) => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        this.hooks.set(type, hooks);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute request hooks
   */
  async executeRequestHooks(ctx: RequestHookContext): Promise<void> {
    await this.execute('request', ctx);
  }

  /**
   * Execute response hooks
   */
  async executeResponseHooks(ctx: ResponseHookContext): Promise<void> {
    await this.execute('response', ctx);
  }

  /**
   * Execute error hooks
   */
  async executeErrorHooks(ctx: ErrorHookContext): Promise<void> {
    await this.execute('error', ctx);
  }

  /**
   * Execute stream hooks
   */
  async executeStreamHooks(ctx: StreamHookContext): Promise<void> {
    await this.execute('stream', ctx);
  }

  /**
   * Execute hooks of a specific type
   */
  private async execute(type: HookType, ctx: HookContext): Promise<void> {
    const hooks = this.hooks.get(type) || [];

    for (const hook of hooks) {
      // Check integration filter
      if (hook.integrationFilter) {
        const filters = Array.isArray(hook.integrationFilter)
          ? hook.integrationFilter
          : [hook.integrationFilter];
        if (!filters.includes(ctx.integrationName)) {
          continue;
        }
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (hook.handler as any)(ctx);
      } catch (error) {
        // Log but don't throw - hooks should not break the main flow
        console.error(`[Brokle] Hook ${hook.id} failed:`, error);
      }
    }
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.set('request', []);
    this.hooks.set('response', []);
    this.hooks.set('error', []);
    this.hooks.set('stream', []);
  }

  /**
   * Get count of registered hooks
   */
  getHookCount(type?: HookType): number {
    if (type) {
      return this.hooks.get(type)?.length || 0;
    }
    let total = 0;
    for (const hooks of this.hooks.values()) {
      total += hooks.length;
    }
    return total;
  }
}

// Global hook registry instance
let globalRegistry: HookRegistry | null = null;

/**
 * Get the global hook registry
 */
export function getHookRegistry(): HookRegistry {
  if (!globalRegistry) {
    globalRegistry = new HookRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global hook registry (mainly for testing)
 */
export function resetHookRegistry(): void {
  globalRegistry = null;
}
