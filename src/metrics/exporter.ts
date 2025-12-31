/**
 * OTLP Metrics Exporter Configuration
 *
 * Creates and configures the OpenTelemetry metrics exporter for Brokle.
 */

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  View,
  ExplicitBucketHistogramAggregation,
} from '@opentelemetry/sdk-metrics';
import type { Resource } from '@opentelemetry/resources';
import type { BrokleConfig } from '../types/config';
import { TransportType, createMetricExporterAsync } from '../transport';
import {
  MetricNames,
  TOKEN_BOUNDARIES,
  DURATION_BOUNDARIES,
  TTFT_BOUNDARIES,
  INTER_TOKEN_BOUNDARIES,
  DEFAULT_METRICS_INTERVAL,
} from './constants';

/**
 * Options for creating the metrics exporter.
 */
export interface MetricsExporterOptions {
  /** Brokle configuration */
  config: BrokleConfig;
  /** OTEL Resource for metrics */
  resource: Resource;
  /** Export interval in milliseconds (default: 60000) */
  exportInterval?: number;
}

/**
 * Creates histogram views with explicit bucket boundaries.
 *
 * @returns Array of View configurations for histograms
 */
function createHistogramViews(): View[] {
  return [
    new View({
      instrumentName: MetricNames.TOKEN_USAGE,
      aggregation: new ExplicitBucketHistogramAggregation([...TOKEN_BOUNDARIES]),
    }),
    new View({
      instrumentName: MetricNames.OPERATION_DURATION,
      aggregation: new ExplicitBucketHistogramAggregation([...DURATION_BOUNDARIES]),
    }),
    new View({
      instrumentName: MetricNames.TIME_TO_FIRST_TOKEN,
      aggregation: new ExplicitBucketHistogramAggregation([...TTFT_BOUNDARIES]),
    }),
    new View({
      instrumentName: MetricNames.INTER_TOKEN_LATENCY,
      aggregation: new ExplicitBucketHistogramAggregation([...INTER_TOKEN_BOUNDARIES]),
    }),
  ];
}

/**
 * Creates the OTLP metrics exporter.
 *
 * @param config - Brokle configuration
 * @returns OTLPMetricExporter instance
 */
export function createMetricsExporter(config: BrokleConfig): OTLPMetricExporter {
  const endpoint = `${config.baseUrl}/v1/metrics`;
  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
  };

  if (config.environment && config.environment !== 'default') {
    headers['X-Brokle-Environment'] = config.environment;
  }

  if (config.debug) {
    console.log('[Brokle] Creating metrics exporter:', { endpoint, timeout: config.timeout });
  }

  return new OTLPMetricExporter({
    url: endpoint,
    headers,
    timeoutMillis: config.timeout,
  });
}

/**
 * Creates and configures a MeterProvider with OTLP export.
 *
 * Note: This function only supports HTTP transport. For gRPC transport,
 * use createMeterProviderAsync() instead.
 *
 * @param options - Metrics exporter options
 * @returns Configured MeterProvider
 * @throws Error if gRPC transport is configured (use createMeterProviderAsync instead)
 */
export function createMeterProvider(options: MetricsExporterOptions): MeterProvider {
  const { config, resource, exportInterval = DEFAULT_METRICS_INTERVAL } = options;

  if (config.transport === TransportType.GRPC) {
    throw new Error(
      'gRPC transport for metrics requires async initialization. ' +
        'Use createMeterProviderAsync() instead.'
    );
  }

  const exporter = createMetricsExporter(config);
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: exportInterval,
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [reader],
    views: createHistogramViews(),
  });

  if (config.debug) {
    console.log('[Brokle] MeterProvider created with:', {
      exportInterval,
      views: 'explicit bucket histograms',
    });
  }

  return meterProvider;
}

/**
 * Creates and configures a MeterProvider with OTLP export asynchronously.
 *
 * This function supports both HTTP and gRPC transports. Use this for gRPC
 * transport which requires async initialization for lazy-loading dependencies.
 *
 * @param options - Metrics exporter options
 * @returns Promise resolving to configured MeterProvider
 */
export async function createMeterProviderAsync(
  options: MetricsExporterOptions
): Promise<MeterProvider> {
  const { config, resource, exportInterval = DEFAULT_METRICS_INTERVAL } = options;

  const exporter = await createMetricExporterAsync(config);
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: exportInterval,
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [reader],
    views: createHistogramViews(),
  });

  if (config.debug) {
    console.log('[Brokle] MeterProvider created with:', {
      exportInterval,
      views: 'explicit bucket histograms',
      transport: config.transport || 'http',
    });
  }

  return meterProvider;
}
