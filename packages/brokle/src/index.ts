/**
 * Brokle SDK - OpenTelemetry-native observability for AI applications
 *
 * @packageDocumentation
 */

// Core client
export { Brokle, getClient, resetClient } from './client';

// Configuration
export type { BrokleConfig, BrokleConfigInput } from './types/config';
export { loadFromEnv, validateConfig } from './config';

// Decorators
export { observe, traceFunction } from './decorators';
export type { ObserveOptions } from './decorators';

// Type-safe attributes
export {
  Attrs,
  BrokleOtelSpanAttributes,
  SpanType,
  LLMProvider,
  OperationType,
} from './types/attributes';

export type {
  AttributeKey,
  ToolCall,
  Message,
  GenAIAttributes,
  TraceAttributes,
} from './types/attributes';

// Exporter (for advanced use cases)
export { createBrokleExporter } from './exporter';

// Processor (for advanced use cases)
export { BrokleSpanProcessor } from './processor';