/**
 * OTLP exporter configuration with Brokle authentication and compression
 *
 * Uses Protobuf format over HTTP (like Python SDK) for backend compatibility
 */

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import type { BrokleConfig } from './types/config';

/**
 * Creates an OTLP trace exporter configured for Brokle backend
 *
 * Features:
 * - Gzip compression for bandwidth optimization
 * - API key authentication via X-API-Key header
 * - Environment tag propagation
 * - Configurable timeout
 *
 * @param config - Brokle configuration
 * @returns Configured OTLP trace exporter
 */
export function createBrokleExporter(config: BrokleConfig): OTLPTraceExporter {
  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
  };

  // Add environment header if not default
  if (config.environment !== 'default') {
    headers['X-Brokle-Environment'] = config.environment;
  }

  // Add release header if provided
  if (config.release) {
    headers['X-Brokle-Release'] = config.release;
  }

  const url = `${config.baseUrl}/v1/otlp/traces`;

  if (config.debug) {
    console.log('[Brokle] Creating OTLP exporter:', {
      url,
      compression: 'gzip',
      timeout: config.timeout,
      environment: config.environment,
    });
  }

  return new OTLPTraceExporter({
    url,
    headers,
    compression: CompressionAlgorithm.GZIP,
    timeoutMillis: config.timeout,
  });
}