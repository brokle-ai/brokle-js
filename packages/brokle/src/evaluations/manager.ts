/**
 * Evaluations Manager
 *
 * Manager for running evaluations and submitting quality scores.
 * Supports both direct scoring and scorer function execution.
 */

import type {
  ScoreOptions,
  BatchScoreOptions,
  ScoreRequest,
  ScoreResponse,
  ScoreResult,
  ScoreValue,
  Scorer,
  APIResponse,
} from './types';
import { ScoreType, ScoreSource } from './types';
import { ScoreError } from './errors';

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
 * Evaluations API manager
 *
 * Provides methods for submitting scores and running evaluations.
 *
 * @example
 * ```typescript
 * // Direct score submission
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   name: "accuracy",
 *   value: 0.95,
 * });
 *
 * // Using a scorer function
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.evaluations.score({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 * ```
 */
export class EvaluationsManager {
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;

  constructor(config: EvaluationsManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
  }

  /**
   * Log debug messages
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle EvaluationsManager] ${message}`, ...args);
    }
  }

  /**
   * Make an HTTP POST request
   */
  private async httpPost<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ScoreError(`API request failed (${response.status}): ${error}`, response.status);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Unwrap API response envelope
   */
  private unwrapResponse<T>(response: APIResponse<T>): T {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new ScoreError('Request failed with no error details');
      }
      throw new ScoreError(`${error.code}: ${error.message}`);
    }

    if (response.data === undefined) {
      throw new ScoreError('Response missing data field');
    }

    return response.data;
  }

  /**
   * Score a trace or span.
   *
   * Two modes:
   * 1. With scorer: Pass scorer function + output/expected
   * 2. Direct: Pass name + value directly
   *
   * @param options - Score options
   * @returns Score response or array of responses (if scorer returns multiple scores)
   *
   * @example
   * ```typescript
   * // Direct score
   * await client.evaluations.score({
   *   traceId: "abc123",
   *   name: "quality",
   *   value: 0.9,
   *   type: ScoreType.NUMERIC,
   *   reason: "High quality response",
   * });
   *
   * // Using scorer function
   * const exact = ExactMatch({ name: "answer_match" });
   * await client.evaluations.score({
   *   traceId: "abc123",
   *   scorer: exact,
   *   output: "Paris",
   *   expected: "Paris",
   * });
   * ```
   */
  async score(options: ScoreOptions): Promise<ScoreResponse | ScoreResponse[]> {
    const {
      traceId,
      spanId,
      scorer,
      name,
      value,
      type = ScoreType.NUMERIC,
      source = ScoreSource.CODE,
      reason,
      metadata,
    } = options;

    if (scorer) {
      return this.scoreWithScorer(options);
    }

    if (!name || value === undefined) {
      throw new ScoreError('name and value required when not using scorer');
    }

    return this.submitScore({
      trace_id: traceId,
      name,
      value,
      type: type,
      source: source,
      span_id: spanId,
      reason,
      metadata,
    });
  }

  /**
   * Submit multiple scores in a batch
   *
   * @param scores - Array of score options
   * @returns Array of score responses
   *
   * @example
   * ```typescript
   * await client.evaluations.scoreBatch([
   *   { traceId: "abc123", name: "accuracy", value: 0.9 },
   *   { traceId: "abc123", name: "fluency", value: 0.85 },
   *   { traceId: "def456", name: "relevance", value: 0.95 },
   * ]);
   * ```
   */
  async scoreBatch(scores: BatchScoreOptions[]): Promise<ScoreResponse[]> {
    const requests: ScoreRequest[] = scores.map((s) => ({
      trace_id: s.traceId,
      name: s.name,
      value: s.value,
      type: s.type || ScoreType.NUMERIC,
      source: s.source || ScoreSource.CODE,
      span_id: s.spanId,
      reason: s.reason,
      metadata: s.metadata,
    }));

    this.log('Batch submitting scores', { count: requests.length });

    const rawResponse = await this.httpPost<APIResponse<{ scores: ScoreResponse[] }>>(
      '/v1/scores/batch',
      { scores: requests }
    );

    const data = this.unwrapResponse(rawResponse);
    return data.scores;
  }

  /**
   * Execute scorer function and submit results
   */
  private async scoreWithScorer(options: ScoreOptions): Promise<ScoreResponse | ScoreResponse[]> {
    const {
      traceId,
      spanId,
      scorer,
      output,
      expected,
      source = ScoreSource.CODE,
      reason,
      metadata,
    } = options;

    if (!scorer) {
      throw new ScoreError('scorer is required for scorer mode');
    }

    let result: ScoreValue;
    try {
      this.log('Executing scorer', { name: scorer.name });
      result = await scorer({ output, expected });
    } catch (error) {
      const scorerName = scorer.name || 'unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log('Scorer execution failed', { scorer: scorerName, error: errorMessage });

      return this.submitScore({
        trace_id: traceId,
        name: scorerName,
        value: 0,
        type: ScoreType.NUMERIC,
        source,
        span_id: spanId,
        reason: `Scorer failed: ${errorMessage}`,
        metadata: { ...metadata, scoringFailed: true, error: errorMessage },
      });
    }

    const results = this.normalizeScoreResult(result, scorer);

    if (results.length === 0) {
      this.log('Scorer returned null, no score submitted');
      return [] as ScoreResponse[];
    }

    const responses: ScoreResponse[] = [];
    for (const scoreResult of results) {
      const resp = await this.submitScore({
        trace_id: traceId,
        name: scoreResult.name,
        value: scoreResult.value,
        type: scoreResult.type || ScoreType.NUMERIC,
        source,
        span_id: spanId,
        string_value: scoreResult.stringValue,
        reason: scoreResult.reason || reason,
        metadata: scoreResult.metadata || metadata,
      });
      responses.push(resp);
    }

    return responses.length === 1 ? responses[0]! : responses;
  }

  /**
   * Normalize scorer return type to ScoreResult[]
   */
  private normalizeScoreResult(result: ScoreValue, scorer: Scorer): ScoreResult[] {
    const scorerName = scorer.name || 'scorer';

    if (result === null) {
      return [];
    }

    if (Array.isArray(result)) {
      return result as ScoreResult[];
    }

    if (typeof result === 'object' && 'name' in result && 'value' in result) {
      return [result as ScoreResult];
    }

    if (typeof result === 'boolean') {
      return [
        {
          name: scorerName,
          value: result ? 1 : 0,
          type: ScoreType.BOOLEAN,
        },
      ];
    }

    if (typeof result === 'number') {
      return [
        {
          name: scorerName,
          value: result,
          type: ScoreType.NUMERIC,
        },
      ];
    }

    throw new ScoreError(
      `Scorer must return ScoreResult, ScoreResult[], number, boolean, or null, got ${typeof result}`
    );
  }

  /**
   * Submit a single score to the API
   */
  private async submitScore(request: ScoreRequest): Promise<ScoreResponse> {
    this.log('Submitting score', { name: request.name, value: request.value });

    const rawResponse = await this.httpPost<APIResponse<ScoreResponse>>('/v1/scores', request);

    return this.unwrapResponse(rawResponse);
  }

  /**
   * @deprecated Use score() instead
   * Legacy method for backwards compatibility
   */
  async run(_traceId: string, _evaluator: string): Promise<never> {
    throw new Error(
      'run() is deprecated. Use score() with a scorer function instead. ' +
        'Example: client.evaluations.score({ traceId, scorer: MyScorer(), output, expected })'
    );
  }
}
