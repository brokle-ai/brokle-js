/**
 * Brokle Client - Main SDK entry point
 *
 * OpenTelemetry-native client with trace-level sampling and Symbol-based singleton.
 */

import { type Span, type Tracer, type Attributes, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { TraceIdRatioBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import type { BrokleConfig, BrokleConfigInput } from './types/config';
import { validateConfig, loadFromEnv } from './config';
import { createBrokleExporter } from './exporter';
import { BrokleSpanProcessor } from './processor';
import { Attrs } from './types/attributes';

// SDK version
const VERSION = '0.1.0';

/**
 * Main Brokle client class
 *
 * Features:
 * - OTEL-native TracerProvider integration
 * - Trace-level sampling (TraceIdRatioBasedSampler)
 * - Symbol-based singleton
 * - No process exit handlers (explicit shutdown)
 * - Helper methods for common patterns
 */
export class Brokle {
  private config: BrokleConfig;
  private provider: NodeTracerProvider;
  private tracer: Tracer;

  /**
   * Creates a new Brokle client instance
   *
   * @param configInput - Configuration object or load from environment
   */
  constructor(configInput?: BrokleConfigInput) {
    // Load and validate configuration
    const input = configInput || loadFromEnv();
    this.config = validateConfig(input);

    if (this.config.debug) {
      console.log('[Brokle] Initializing SDK with config:', {
        baseUrl: this.config.baseUrl,
        environment: this.config.environment,
        sampleRate: this.config.sampleRate,
        flushSync: this.config.flushSync,
      });
    }

    // Create Resource (respects OTEL environment variables)
    // Note: We don't set service.name to respect user's OTEL_SERVICE_NAME
    // SDK identification is done via instrumentation scope (getTracer name/version)
    // Project ID comes from backend auth, environment set as span attribute
    const resource = Resource.default();

    // Create sampler for trace-level sampling
    // Uses TraceIdRatioBasedSampler for deterministic sampling
    // This ensures entire traces are sampled together (no partial traces)
    const sampler =
      this.config.sampleRate < 1.0
        ? new TraceIdRatioBasedSampler(this.config.sampleRate)
        : new AlwaysOnSampler();

    if (this.config.debug) {
      console.log(
        `[Brokle] Using ${this.config.sampleRate < 1.0 ? `TraceIdRatioBasedSampler (${this.config.sampleRate})` : 'AlwaysOnSampler'}`
      );
    }

    // Create TracerProvider with sampler
    this.provider = new NodeTracerProvider({
      resource,
      sampler,
    });

    // Create OTLP exporter with Gzip compression
    const exporter = createBrokleExporter(this.config);

    // Create processor (wrapper pattern)
    const processor = new BrokleSpanProcessor(exporter, this.config);

    // Add processor to provider
    this.provider.addSpanProcessor(processor);

    // Register the provider globally (optional, for OTEL ecosystem compatibility)
    if (this.config.tracingEnabled) {
      this.provider.register();
    }

    // Get tracer instance
    this.tracer = this.provider.getTracer('brokle', VERSION);

    if (this.config.debug) {
      console.log('[Brokle] SDK initialized successfully');
    }
  }

  /**
   * Create a traced span with async callback
   *
   * @param name - Span name
   * @param fn - Async function to execute within span
   * @param attributes - Optional span attributes
   * @param options - Optional configuration (version for A/B testing)
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * const result = await client.traced('my-operation', async (span) => {
   *   span.setAttribute('custom', 'value');
   *   return processData();
   * }, undefined, { version: '1.0' });
   * ```
   */
  async traced<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
    options?: { version?: string }
  ): Promise<T> {
    const attrs = { ...(attributes ?? {}) };  // Fix: nullish coalescing for undefined

    if (options?.version) {
      attrs[Attrs.BROKLE_VERSION] = options.version;
    }

    return await this.tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const err = error as Error;
        span.recordException(err);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Create a traced LLM generation span
   *
   * @param name - Operation name (e.g., 'chat', 'completion')
   * @param model - Model name (e.g., 'gpt-4')
   * @param provider - Provider name (e.g., 'openai')
   * @param fn - Async function to execute
   * @param options - Optional configuration (version for A/B testing)
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * const response = await client.generation('chat', 'gpt-4', 'openai', async (span) => {
   *   const response = await openai.chat.completions.create({...});
   *   span.setAttribute(Attrs.GEN_AI_OUTPUT_MESSAGES, JSON.stringify([...]));
   *   return response;
   * }, { version: '1.0' });
   * ```
   */
  async generation<T>(
    name: string,
    model: string,
    provider: string,
    fn: (span: Span) => Promise<T>,
    options?: { version?: string }
  ): Promise<T> {
    const spanName = `${name} ${model}`;
    const attrs: Attributes = {
      [Attrs.BROKLE_OBSERVATION_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: provider,
      [Attrs.GEN_AI_OPERATION_NAME]: name,
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };

    // Forward options (including version) to traced()
    return await this.traced(spanName, fn, attrs, options);
  }

  /**
   * Get the OTEL tracer for manual span control
   * Required for integrations like LangChain callbacks
   *
   * @returns OpenTelemetry Tracer instance
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get the TracerProvider for advanced use cases
   *
   * @returns NodeTracerProvider instance
   */
  getProvider(): NodeTracerProvider {
    return this.provider;
  }

  /**
   * Force flush all pending spans to backend
   * Use before process exit in serverless/CLI applications
   *
   * @example
   * ```typescript
   * await client.flush();
   * process.exit(0);
   * ```
   */
  async flush(): Promise<void> {
    if (this.config.debug) {
      console.log('[Brokle] Flushing pending spans...');
    }
    await this.provider.forceFlush();
  }

  /**
   * Shutdown the TracerProvider and clean up resources
   * Use for graceful shutdown in long-running applications
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await client.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  async shutdown(): Promise<void> {
    if (this.config.debug) {
      console.log('[Brokle] Shutting down SDK...');
    }
    await this.provider.shutdown();
  }
}

// ========== Singleton Pattern (Symbol-based pattern) ==========

/**
 * Symbol for global state storage
 * Ensures uniqueness across the entire process
 */
const BROKLE_GLOBAL_SYMBOL = Symbol.for('brokle');

/**
 * Global state structure
 */
interface BrokleGlobalState {
  provider: NodeTracerProvider | null;
  client: Brokle | null;
}

/**
 * Get or create global state
 * Uses Symbol.for() for cross-realm uniqueness
 */
function getGlobalState(): BrokleGlobalState {
  const g = globalThis as typeof globalThis & {
    [BROKLE_GLOBAL_SYMBOL]?: BrokleGlobalState;
  };

  if (!g[BROKLE_GLOBAL_SYMBOL]) {
    Object.defineProperty(g, BROKLE_GLOBAL_SYMBOL, {
      value: { provider: null, client: null },
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }

  return g[BROKLE_GLOBAL_SYMBOL]!;
}

/**
 * Get or create singleton Brokle client
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Singleton Brokle client instance
 *
 * @example
 * ```typescript
 * // First call creates the client
 * const client = getClient({ apiKey: 'bk_...' });
 *
 * // Subsequent calls return the same instance
 * const sameClient = getClient(); // No config needed
 * ```
 */
export function getClient(config?: BrokleConfigInput): Brokle {
  const state = getGlobalState();

  if (!state.client) {
    const clientConfig = config || loadFromEnv();
    state.client = new Brokle(clientConfig);
    state.provider = state.client.getProvider();
  }

  return state.client;
}

/**
 * Reset the singleton client (for testing)
 * Shuts down the current client and clears global state
 *
 * @example
 * ```typescript
 * // In tests
 * afterEach(async () => {
 *   await resetClient();
 * });
 * ```
 */
export async function resetClient(): Promise<void> {
  const state = getGlobalState();

  if (state.client) {
    await state.client.shutdown();
    state.client = null;
    state.provider = null;
  }
}

/**
 * Note on lifecycle management:
 *
 * NO process exit handlers are registered automatically.
 * This prevents:
 * - Memory leaks from multiple handlers
 * - Double shutdown issues
 * - Conflicts with application lifecycle
 *
 * Applications should manage shutdown explicitly:
 *
 * Long-running apps:
 *   const client = getClient();
 *   process.on('SIGTERM', async () => {
 *     await client.shutdown();
 *     process.exit(0);
 *   });
 *
 * Serverless/CLI:
 *   const client = getClient();
 *   // ... do work ...
 *   await client.flush();
 */