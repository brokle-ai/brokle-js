/**
 * Evaluations Manager
 *
 * Manager for running evaluations and submitting quality scores (stub for future implementation).
 */

/**
 * Configuration for the evaluations manager
 */
export interface EvaluationsManagerConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Evaluations API manager (stub for future implementation)
 *
 * This is a placeholder for future evaluation functionality.
 * All methods will throw NotImplementedError until the API is ready.
 */
export class EvaluationsManager {
  constructor(_config: EvaluationsManagerConfig) {}


  /**
   * Run an evaluation on a trace
   *
   * @param traceId - Trace ID to evaluate
   * @param evaluator - Evaluator name
   * @returns Evaluation result
   * @throws NotImplementedError - This feature is not yet implemented
   *
   * @example
   * ```typescript
   * // Future functionality:
   * // const result = await client.evaluations.run(traceId, 'accuracy');
   * ```
   */
  async run(_traceId: string, _evaluator: string): Promise<never> {
    throw new Error(
      'Evaluations API not yet implemented. This is a stub for future functionality.'
    );
  }

  /**
   * Submit a quality score for a span
   *
   * @param spanId - Span ID to score
   * @param name - Score name (e.g., 'accuracy', 'relevance')
   * @param value - Score value
   * @returns Score submission result
   * @throws NotImplementedError - This feature is not yet implemented
   *
   * @example
   * ```typescript
   * // Future functionality:
   * // const score = await client.evaluations.score(spanId, 'relevance', 0.95);
   * ```
   */
  async score(_spanId: string, _name: string, _value: number): Promise<never> {
    throw new Error(
      'Scoring API not yet implemented. This is a stub for future functionality.'
    );
  }
}
