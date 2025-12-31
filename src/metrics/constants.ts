/**
 * Histogram bucket boundaries for GenAI metrics.
 * Matches Python SDK for cross-platform consistency.
 */

/** Token count histogram boundaries (1 to 131K tokens) */
export const TOKEN_BOUNDARIES = [
  1, 2, 4, 8, 16, 32, 64,
  128, 256, 512, 1024,
  2048, 4096, 8192,
  16384, 32768, 65536,
  131072,
] as const;

/** Operation duration histogram boundaries (10ms to 30s) */
export const DURATION_BOUNDARIES = [
  10, 25, 50, 75, 100,
  150, 200, 300, 500,
  750, 1000, 2000,
  5000, 10000, 30000,
] as const;

/** Time-to-first-token histogram boundaries (10ms to 10s) */
export const TTFT_BOUNDARIES = [
  10, 25, 50, 75, 100,
  150, 200, 300, 500,
  750, 1000, 2000,
  5000, 10000,
] as const;

/** Inter-token latency histogram boundaries (1ms to 500ms) */
export const INTER_TOKEN_BOUNDARIES = [
  1, 2, 5, 10, 15,
  20, 30, 50, 75, 100,
  150, 200, 300, 500,
] as const;

/** OTEL GenAI metric names following semantic conventions */
export const MetricNames = {
  TOKEN_USAGE: 'gen_ai.client.token.usage',
  OPERATION_DURATION: 'gen_ai.client.operation.duration',
  TIME_TO_FIRST_TOKEN: 'gen_ai.client.time_to_first_token',
  INTER_TOKEN_LATENCY: 'gen_ai.client.inter_token_latency',
  REQUEST_COUNT: 'gen_ai.client.request.count',
  ERROR_COUNT: 'gen_ai.client.error.count',
  INPUT_TOKENS: 'gen_ai.client.input_tokens',
  OUTPUT_TOKENS: 'gen_ai.client.output_tokens',
} as const;

/** Default metrics export interval (60 seconds) */
export const DEFAULT_METRICS_INTERVAL = 60000;
