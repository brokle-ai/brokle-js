/**
 * OTLP Logs Exporter Configuration
 *
 * Creates and configures the OpenTelemetry logs exporter for Brokle.
 * Logs export is opt-in (disabled by default) to match Python SDK behavior.
 */

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { Resource } from '@opentelemetry/resources';
import type { BrokleConfig } from '../types/config';
import { TransportType, createLogExporterAsync } from '../transport';

/**
 * Options for creating the logs exporter.
 */
export interface LogsExporterOptions {
  /** Brokle configuration */
  config: BrokleConfig;
  /** OTEL Resource for logs */
  resource: Resource;
  /** Use SimpleLogRecordProcessor instead of BatchLogRecordProcessor (for serverless) */
  flushSync?: boolean;
}

/**
 * Creates the OTLP logs exporter.
 *
 * @param config - Brokle configuration
 * @returns OTLPLogExporter instance
 */
export function createLogsExporter(config: BrokleConfig): OTLPLogExporter {
  const endpoint = `${config.baseUrl}/v1/logs`;
  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
  };

  if (config.environment && config.environment !== 'default') {
    headers['X-Brokle-Environment'] = config.environment;
  }

  if (config.debug) {
    console.log('[Brokle] Creating logs exporter:', { endpoint, timeout: config.timeout });
  }

  return new OTLPLogExporter({
    url: endpoint,
    headers,
    timeoutMillis: config.timeout,
  });
}

/**
 * Creates and configures a LoggerProvider with OTLP export.
 *
 * Note: This function only supports HTTP transport. For gRPC transport,
 * use createLoggerProviderAsync() instead.
 *
 * @param options - Logs exporter options
 * @returns Configured LoggerProvider
 * @throws Error if gRPC transport is configured (use createLoggerProviderAsync instead)
 */
export function createLoggerProvider(options: LogsExporterOptions): LoggerProvider {
  const { config, resource, flushSync = false } = options;

  if (config.transport === TransportType.GRPC) {
    throw new Error(
      'gRPC transport for logs requires async initialization. ' +
        'Use createLoggerProviderAsync() instead.'
    );
  }

  const exporter = createLogsExporter(config);

  // Create processor based on sync/async mode
  const processor = flushSync
    ? new SimpleLogRecordProcessor(exporter)
    : new BatchLogRecordProcessor(exporter, {
        maxQueueSize: config.maxQueueSize,
        maxExportBatchSize: config.flushAt,
        scheduledDelayMillis: config.flushInterval * 1000,
        exportTimeoutMillis: config.timeout,
      });

  // OTEL 2.x: Pass processors via constructor (addLogRecordProcessor removed)
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [processor],
  });

  if (config.debug) {
    if (flushSync) {
      console.log('[Brokle] LoggerProvider created with SimpleLogRecordProcessor');
    } else {
      console.log('[Brokle] LoggerProvider created with BatchLogRecordProcessor:', {
        maxQueueSize: config.maxQueueSize,
        maxExportBatchSize: config.flushAt,
        scheduledDelayMillis: config.flushInterval * 1000,
      });
    }
  }

  return loggerProvider;
}

/**
 * Creates and configures a LoggerProvider with OTLP export asynchronously.
 *
 * This function supports both HTTP and gRPC transports. Use this for gRPC
 * transport which requires async initialization for lazy-loading dependencies.
 *
 * @param options - Logs exporter options
 * @returns Promise resolving to configured LoggerProvider
 */
export async function createLoggerProviderAsync(
  options: LogsExporterOptions
): Promise<LoggerProvider> {
  const { config, resource, flushSync = false } = options;

  const exporter = await createLogExporterAsync(config);

  // Create processor based on sync/async mode
  const processor = flushSync
    ? new SimpleLogRecordProcessor(exporter)
    : new BatchLogRecordProcessor(exporter, {
        maxQueueSize: config.maxQueueSize,
        maxExportBatchSize: config.flushAt,
        scheduledDelayMillis: config.flushInterval * 1000,
        exportTimeoutMillis: config.timeout,
      });

  // OTEL 2.x: Pass processors via constructor (addLogRecordProcessor removed)
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [processor],
  });

  if (config.debug) {
    if (flushSync) {
      console.log('[Brokle] LoggerProvider created with SimpleLogRecordProcessor (gRPC)');
    } else {
      console.log('[Brokle] LoggerProvider created with BatchLogRecordProcessor:', {
        maxQueueSize: config.maxQueueSize,
        maxExportBatchSize: config.flushAt,
        scheduledDelayMillis: config.flushInterval * 1000,
        transport: config.transport || 'http',
      });
    }
  }

  return loggerProvider;
}
