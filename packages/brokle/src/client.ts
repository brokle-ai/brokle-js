/**
 * Brokle Client - Main SDK entry point
 *
 * OpenTelemetry-native client with trace-level sampling and Symbol-based singleton.
 * Supports traces, metrics, and logs export via OTLP (HTTP or gRPC).
 */

import { type Span, type Tracer, type Attributes, SpanStatusCode, metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { TraceIdRatioBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';
import type { LoggerProvider } from '@opentelemetry/sdk-logs';
import type { BrokleConfig, BrokleConfigInput } from './types/config';
import { validateConfig, loadFromEnv } from './config';
import { createTraceExporter, createTraceExporterAsync, TransportType } from './transport';
import { createMeterProviderAsync } from './metrics';
import { createLoggerProviderAsync } from './logs';
import { BrokleSpanProcessor } from './processor';
import { Attrs } from './types/attributes';
import { createMeterProvider, GenAIMetrics } from './metrics';
import { createLoggerProvider } from './logs';

// SDK version
const VERSION = '0.1.4';

/**
 * Main Brokle client class
 *
 * Features:
 * - OTEL-native TracerProvider integration
 * - OTEL-native MeterProvider for metrics
 * - OTEL-native LoggerProvider for logs (opt-in)
 * - Trace-level sampling (TraceIdRatioBasedSampler)
 * - Symbol-based singleton
 * - No process exit handlers (explicit shutdown)
 * - Helper methods for common patterns
 */
export class Brokle {
  private config: BrokleConfig;
  private provider: NodeTracerProvider;
  private tracer: Tracer;
  private meterProvider: MeterProvider | null = null;
  private loggerProvider: LoggerProvider | null = null;
  private genAIMetrics: GenAIMetrics | null = null;

  /**
   * Creates a new Brokle client instance
   *
   * @param configInput - Configuration object or load from environment
   */
  constructor(configInput?: BrokleConfigInput) {
    const input = configInput || loadFromEnv();
    this.config = validateConfig(input);

    if (this.config.debug) {
      console.log('[Brokle] Initializing SDK with config:', {
        baseUrl: this.config.baseUrl,
        environment: this.config.environment,
        sampleRate: this.config.sampleRate,
        flushSync: this.config.flushSync,
        metricsEnabled: this.config.metricsEnabled,
        logsEnabled: this.config.logsEnabled,
        transport: this.config.transport,
      });
    }

    // Resource: We don't set service.name to respect user's OTEL_SERVICE_NAME.
    // SDK identification via instrumentation scope, project ID from backend auth.
    let resource = Resource.default();
    const resourceAttrs: Record<string, string> = {};
    if (this.config.release) {
      resourceAttrs[Attrs.BROKLE_RELEASE] = this.config.release;
    }
    if (this.config.version) {
      resourceAttrs[Attrs.BROKLE_VERSION] = this.config.version;
    }

    if (Object.keys(resourceAttrs).length > 0) {
      resource = resource.merge(new Resource(resourceAttrs));
    }

    // TraceIdRatioBasedSampler ensures entire traces are sampled together (no partial traces)
    const sampler =
      this.config.sampleRate < 1.0
        ? new TraceIdRatioBasedSampler(this.config.sampleRate)
        : new AlwaysOnSampler();

    if (this.config.debug) {
      console.log(
        `[Brokle] Using ${this.config.sampleRate < 1.0 ? `TraceIdRatioBasedSampler (${this.config.sampleRate})` : 'AlwaysOnSampler'}`
      );
    }

    if (this.config.transport === TransportType.GRPC) {
      throw new Error(
        'gRPC transport requires async initialization. ' +
          'Use Brokle.createAsync(config) instead of new Brokle(config).'
      );
    }

    this.provider = new NodeTracerProvider({ resource, sampler });
    const exporter = createTraceExporter(this.config);
    const processor = new BrokleSpanProcessor(exporter, this.config);
    this.provider.addSpanProcessor(processor);

    if (this.config.tracingEnabled) {
      this.provider.register();
    }

    this.tracer = this.provider.getTracer('brokle', VERSION);

    if (this.config.metricsEnabled) {
      this.meterProvider = createMeterProvider({
        config: this.config,
        resource,
        exportInterval: this.config.metricsInterval,
      });
      metrics.setGlobalMeterProvider(this.meterProvider);
      this.genAIMetrics = new GenAIMetrics('brokle', VERSION);

      if (this.config.debug) {
        console.log('[Brokle] MeterProvider initialized');
      }
    }

    if (this.config.logsEnabled) {
      this.loggerProvider = createLoggerProvider({
        config: this.config,
        resource,
        flushSync: this.config.flushSync,
      });
      logs.setGlobalLoggerProvider(this.loggerProvider);

      if (this.config.debug) {
        console.log('[Brokle] LoggerProvider initialized');
      }
    }

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
   * @param options - Optional configuration
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * // Generic input/output
   * const result = await client.traced('api-request', async (span) => {
   *   return processData();
   * }, undefined, {
   *   version: '1.0',
   *   input: { endpoint: '/weather', query: 'Bangalore' },
   *   output: { status: 200, data: { temp: 25 } }
   * });
   *
   * // LLM messages (auto-detected)
   * await client.traced('llm-trace', async (span) => {
   *   // ...
   * }, undefined, {
   *   input: [{ role: 'user', content: 'Hello' }],
   *   output: [{ role: 'assistant', content: 'Hi!' }]
   * });
   * ```
   */
  async traced<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes,
    options?: {
      version?: string;
      input?: unknown;
      output?: unknown;
    }
  ): Promise<T> {
    const attrs = { ...(attributes ?? {}) };

    if (options?.version) {
      attrs[Attrs.BROKLE_VERSION] = options.version;
    }

    // Auto-detect LLM messages (ChatML) vs generic data
    if (options?.input !== undefined) {
      if (isChatMLFormat(options.input)) {
        attrs[Attrs.GEN_AI_INPUT_MESSAGES] = JSON.stringify(options.input);
      } else {
        const [inputStr, mimeType] = serializeWithMime(options.input);
        attrs[Attrs.INPUT_VALUE] = inputStr;
        attrs[Attrs.INPUT_MIME_TYPE] = mimeType;
      }
    }

    if (options?.output !== undefined) {
      if (isChatMLFormat(options.output)) {
        attrs[Attrs.GEN_AI_OUTPUT_MESSAGES] = JSON.stringify(options.output);
      } else {
        const [outputStr, mimeType] = serializeWithMime(options.output);
        attrs[Attrs.OUTPUT_VALUE] = outputStr;
        attrs[Attrs.OUTPUT_MIME_TYPE] = mimeType;
      }
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
      [Attrs.BROKLE_SPAN_TYPE]: 'generation',
      [Attrs.GEN_AI_PROVIDER_NAME]: provider,
      [Attrs.GEN_AI_OPERATION_NAME]: name,
      [Attrs.GEN_AI_REQUEST_MODEL]: model,
    };
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
   * Get the MeterProvider for advanced use cases
   *
   * @returns MeterProvider instance or null if metrics disabled
   */
  getMeterProvider(): MeterProvider | null {
    return this.meterProvider;
  }

  /**
   * Get the LoggerProvider for advanced use cases
   *
   * @returns LoggerProvider instance or null if logs disabled
   */
  getLoggerProvider(): LoggerProvider | null {
    return this.loggerProvider;
  }

  /**
   * Get the GenAI metrics instance for recording custom metrics
   *
   * @returns GenAIMetrics instance or null if metrics disabled
   */
  getMetrics(): GenAIMetrics | null {
    return this.genAIMetrics;
  }

  /**
   * Force flush all pending telemetry to backend
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
      console.log('[Brokle] Flushing pending telemetry...');
    }

    const flushPromises: Promise<void>[] = [this.provider.forceFlush()];

    if (this.meterProvider) {
      flushPromises.push(this.meterProvider.forceFlush());
    }

    if (this.loggerProvider) {
      flushPromises.push(this.loggerProvider.forceFlush());
    }

    await Promise.all(flushPromises);
  }

  /**
   * Shutdown all providers and clean up resources
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

    const shutdownPromises: Promise<void>[] = [this.provider.shutdown()];

    if (this.meterProvider) {
      shutdownPromises.push(this.meterProvider.shutdown());
    }

    if (this.loggerProvider) {
      shutdownPromises.push(this.loggerProvider.shutdown());
    }

    await Promise.all(shutdownPromises);
  }

  /**
   * Create a Brokle client asynchronously (required for gRPC transport)
   *
   * Use this factory method when using gRPC transport, as gRPC exporters
   * require async initialization for lazy-loading dependencies.
   *
   * @param configInput - Configuration object or load from environment
   * @returns Promise resolving to Brokle client instance
   *
   * @example
   * ```typescript
   * // gRPC transport requires async initialization
   * const client = await Brokle.createAsync({
   *   apiKey: 'bk_...',
   *   transport: 'grpc',
   *   grpcEndpoint: 'localhost:4317',
   * });
   *
   * // HTTP transport also works (delegates to sync constructor)
   * const httpClient = await Brokle.createAsync({
   *   apiKey: 'bk_...',
   *   // transport defaults to 'http'
   * });
   * ```
   */
  static async createAsync(configInput?: BrokleConfigInput): Promise<Brokle> {
    const input = configInput || loadFromEnv();
    const config = validateConfig(input);

    if (config.transport !== TransportType.GRPC) {
      return new Brokle(configInput);
    }

    if (config.debug) {
      console.log('[Brokle] Initializing SDK with gRPC transport...');
    }

    // gRPC requires async exporters, create providers manually
    let resource = Resource.default();
    const resourceAttrs: Record<string, string> = {};
    if (config.release) {
      resourceAttrs[Attrs.BROKLE_RELEASE] = config.release;
    }
    if (config.version) {
      resourceAttrs[Attrs.BROKLE_VERSION] = config.version;
    }
    if (Object.keys(resourceAttrs).length > 0) {
      resource = resource.merge(new Resource(resourceAttrs));
    }

    const sampler =
      config.sampleRate < 1.0
        ? new TraceIdRatioBasedSampler(config.sampleRate)
        : new AlwaysOnSampler();

    const provider = new NodeTracerProvider({ resource, sampler });
    const exporter = await createTraceExporterAsync(config);
    const processor = new BrokleSpanProcessor(exporter, config);
    provider.addSpanProcessor(processor);

    if (config.tracingEnabled) {
      provider.register();
    }

    const tracer = provider.getTracer('brokle', VERSION);

    let meterProvider: MeterProvider | null = null;
    let genAIMetrics: GenAIMetrics | null = null;
    if (config.metricsEnabled) {
      meterProvider = await createMeterProviderAsync({
        config,
        resource,
        exportInterval: config.metricsInterval,
      });
      metrics.setGlobalMeterProvider(meterProvider);
      genAIMetrics = new GenAIMetrics('brokle', VERSION);

      if (config.debug) {
        console.log('[Brokle] gRPC MeterProvider initialized');
      }
    }

    let loggerProvider: LoggerProvider | null = null;
    if (config.logsEnabled) {
      loggerProvider = await createLoggerProviderAsync({
        config,
        resource,
        flushSync: config.flushSync,
      });
      logs.setGlobalLoggerProvider(loggerProvider);

      if (config.debug) {
        console.log('[Brokle] gRPC LoggerProvider initialized');
      }
    }

    if (config.debug) {
      console.log('[Brokle] SDK initialized successfully with gRPC transport');
    }

    // Bypass constructor using Object.create to set properties directly
    const instance = Object.create(Brokle.prototype) as Brokle;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).config = config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).provider = provider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).tracer = tracer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).meterProvider = meterProvider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).loggerProvider = loggerProvider;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).genAIMetrics = genAIMetrics;

    return instance;
  }
}

// Singleton Pattern using Symbol.for() for cross-realm uniqueness
const BROKLE_GLOBAL_SYMBOL = Symbol.for('brokle');

interface BrokleGlobalState {
  provider: NodeTracerProvider | null;
  client: Brokle | null;
}

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

  // Non-null assertion safe: property defined in previous if block
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
 * Serialize value with MIME type detection
 * Handles edge cases: null, objects, arrays, strings, etc.
 */
function serializeWithMime(value: unknown): [string, string] {
  try {
    if (value === null || value === undefined) {
      return ['null', 'application/json'];
    }

    if (typeof value === 'string') {
      return [value, 'text/plain'];
    }

    if (typeof value === 'object') {
      // Objects and arrays → JSON
      return [JSON.stringify(value), 'application/json'];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value), 'text/plain'];
    }

    // Fallback
    return [String(value), 'text/plain'];
  } catch (error) {
    // Serialization failed
    const err = error as Error;
    return [`<serialization failed: ${err.message}>`, 'text/plain'];
  }
}

/**
 * Check if data is in ChatML messages format
 */
function isChatMLFormat(data: unknown): boolean {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((msg) => typeof msg === 'object' && msg !== null && 'role' in msg)
  );
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