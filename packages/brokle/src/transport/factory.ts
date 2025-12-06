/**
 * Transport factory for creating OTLP exporters.
 *
 * Supports HTTP and gRPC transports for traces, metrics, and logs.
 */

import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter as OTLPLogExporterHttp } from '@opentelemetry/exporter-logs-otlp-proto';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import type { Metadata } from '@grpc/grpc-js';
import type { BrokleConfig } from '../types/config';
import { TransportType } from './types';

// Dynamic imports for gRPC (optional dependency)
let OTLPTraceExporterGrpc: typeof import('@opentelemetry/exporter-trace-otlp-grpc').OTLPTraceExporter | undefined;
let OTLPMetricExporterGrpc: typeof import('@opentelemetry/exporter-metrics-otlp-grpc').OTLPMetricExporter | undefined;
let OTLPLogExporterGrpc: typeof import('@opentelemetry/exporter-logs-otlp-grpc').OTLPLogExporter | undefined;

// Lazy loaded Metadata class from @grpc/grpc-js
let GrpcMetadata: typeof Metadata | undefined;

async function loadGrpcMetadata(): Promise<void> {
  if (!GrpcMetadata) {
    try {
      const grpcModule = await import('@grpc/grpc-js');
      GrpcMetadata = grpcModule.Metadata;
    } catch {
      throw new Error(
        'gRPC transport requires @grpc/grpc-js. ' +
          'Install it with: pnpm add @grpc/grpc-js'
      );
    }
  }
}

function headersToGrpcMetadata(headers: Record<string, string>): Metadata {
  if (!GrpcMetadata) {
    throw new Error('gRPC Metadata class not loaded. Call loadGrpcMetadata() first.');
  }
  const metadata = new GrpcMetadata();
  for (const [key, value] of Object.entries(headers)) {
    metadata.set(key, value);
  }
  return metadata;
}

async function loadGrpcTraceExporter(): Promise<void> {
  await loadGrpcMetadata();

  if (!OTLPTraceExporterGrpc) {
    try {
      const traceModule = await import('@opentelemetry/exporter-trace-otlp-grpc');
      OTLPTraceExporterGrpc = traceModule.OTLPTraceExporter;
    } catch {
      throw new Error(
        'gRPC transport for traces requires @opentelemetry/exporter-trace-otlp-grpc. ' +
          'Install it with: pnpm add @opentelemetry/exporter-trace-otlp-grpc'
      );
    }
  }
}

async function loadGrpcMetricExporter(): Promise<void> {
  await loadGrpcMetadata();

  if (!OTLPMetricExporterGrpc) {
    try {
      const metricModule = await import('@opentelemetry/exporter-metrics-otlp-grpc');
      OTLPMetricExporterGrpc = metricModule.OTLPMetricExporter;
    } catch {
      throw new Error(
        'gRPC transport for metrics requires @opentelemetry/exporter-metrics-otlp-grpc. ' +
          'Install it with: pnpm add @opentelemetry/exporter-metrics-otlp-grpc'
      );
    }
  }
}

async function loadGrpcLogExporter(): Promise<void> {
  await loadGrpcMetadata();

  if (!OTLPLogExporterGrpc) {
    try {
      const logModule = await import('@opentelemetry/exporter-logs-otlp-grpc');
      OTLPLogExporterGrpc = logModule.OTLPLogExporter;
    } catch {
      throw new Error(
        'gRPC transport for logs requires @opentelemetry/exporter-logs-otlp-grpc. ' +
          'Install it with: pnpm add @opentelemetry/exporter-logs-otlp-grpc'
      );
    }
  }
}

function buildHeaders(config: BrokleConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
  };

  if (config.environment && config.environment !== 'default') {
    headers['X-Brokle-Environment'] = config.environment;
  }

  return headers;
}

function getGrpcEndpoint(config: BrokleConfig): string {
  if (config.grpcEndpoint) {
    return config.grpcEndpoint;
  }

  try {
    const url = new URL(config.baseUrl);
    return `${url.hostname}:4317`;
  } catch {
    return 'localhost:4317';
  }
}

export function createTraceExporter(
  config: BrokleConfig
): OTLPTraceExporterHttp {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    throw new Error(
      'gRPC transport for traces requires async initialization. ' +
        'Use createTraceExporterAsync() instead.'
    );
  }

  const endpoint = `${config.baseUrl}/v1/traces`;
  const headers = buildHeaders(config);

  if (config.debug) {
    console.log('[Brokle] Creating HTTP trace exporter:', { endpoint, compression: 'gzip' });
  }

  return new OTLPTraceExporterHttp({
    url: endpoint,
    headers,
    compression: CompressionAlgorithm.GZIP,
    timeoutMillis: config.timeout,
  });
}

export async function createTraceExporterAsync(
  config: BrokleConfig
): Promise<OTLPTraceExporterHttp | InstanceType<NonNullable<typeof OTLPTraceExporterGrpc>>> {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    await loadGrpcTraceExporter();
    const endpoint = getGrpcEndpoint(config);
    const headers = buildHeaders(config);

    if (config.debug) {
      console.log('[Brokle] Creating gRPC trace exporter:', { endpoint });
    }

    if (!OTLPTraceExporterGrpc) {
      throw new Error('gRPC trace exporter failed to load');
    }
    return new OTLPTraceExporterGrpc({
      url: endpoint,
      metadata: headersToGrpcMetadata(headers),
      timeoutMillis: config.timeout,
    });
  }

  return createTraceExporter(config);
}

export function createMetricExporter(
  config: BrokleConfig
): OTLPMetricExporterHttp {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    throw new Error(
      'gRPC transport for metrics requires async initialization. ' +
        'Use createMetricExporterAsync() instead.'
    );
  }

  const endpoint = `${config.baseUrl}/v1/metrics`;
  const headers = buildHeaders(config);

  if (config.debug) {
    console.log('[Brokle] Creating HTTP metric exporter:', { endpoint, compression: 'gzip' });
  }

  return new OTLPMetricExporterHttp({
    url: endpoint,
    headers,
    compression: CompressionAlgorithm.GZIP,
    timeoutMillis: config.timeout,
  });
}

export async function createMetricExporterAsync(
  config: BrokleConfig
): Promise<OTLPMetricExporterHttp | InstanceType<NonNullable<typeof OTLPMetricExporterGrpc>>> {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    await loadGrpcMetricExporter();
    const endpoint = getGrpcEndpoint(config);
    const headers = buildHeaders(config);

    if (config.debug) {
      console.log('[Brokle] Creating gRPC metric exporter:', { endpoint });
    }

    if (!OTLPMetricExporterGrpc) {
      throw new Error('gRPC metric exporter failed to load');
    }
    return new OTLPMetricExporterGrpc({
      url: endpoint,
      metadata: headersToGrpcMetadata(headers),
      timeoutMillis: config.timeout,
    });
  }

  return createMetricExporter(config);
}

export function createLogExporter(config: BrokleConfig): OTLPLogExporterHttp {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    throw new Error(
      'gRPC transport for logs requires async initialization. ' +
        'Use createLogExporterAsync() instead.'
    );
  }

  const endpoint = `${config.baseUrl}/v1/logs`;
  const headers = buildHeaders(config);

  if (config.debug) {
    console.log('[Brokle] Creating HTTP log exporter:', { endpoint });
  }

  return new OTLPLogExporterHttp({
    url: endpoint,
    headers,
    timeoutMillis: config.timeout,
  });
}

export async function createLogExporterAsync(
  config: BrokleConfig
): Promise<OTLPLogExporterHttp | InstanceType<NonNullable<typeof OTLPLogExporterGrpc>>> {
  const transport = config.transport || TransportType.HTTP;

  if (transport === TransportType.GRPC) {
    await loadGrpcLogExporter();
    const endpoint = getGrpcEndpoint(config);
    const headers = buildHeaders(config);

    if (config.debug) {
      console.log('[Brokle] Creating gRPC log exporter:', { endpoint });
    }

    if (!OTLPLogExporterGrpc) {
      throw new Error('gRPC log exporter failed to load');
    }
    return new OTLPLogExporterGrpc({
      url: endpoint,
      metadata: headersToGrpcMetadata(headers),
      timeoutMillis: config.timeout,
    });
  }

  return createLogExporter(config);
}
