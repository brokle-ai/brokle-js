/**
 * Scores Manager
 *
 * Manager for submitting quality scores to traces and spans.
 * Follows Stripe/OpenAI namespace pattern: client.scores.submit()
 */

import { BrokleHttpClient } from '../_http';
import type {
  ScoresManagerConfig,
  SubmitScoreOptions,
  BatchScoreOptions,
  ScoreRequest,
  ScoreResponse,
  ScoreResult,
  ScoreValue,
  Scorer,
  BatchScoreResult,
} from './types';
import { ScoreType, ScoreSource } from './types';
import { ScorerError } from './errors';

/**
 * Scores API manager
 *
 * Provides methods for submitting scores to traces and spans.
 *
 * @example
 * ```typescript
 * // Direct score submission
 * await client.scores.submit({
 *   traceId: "abc123",
 *   name: "accuracy",
 *   value: 0.95,
 * });
 *
 * // Using a scorer function
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 *
 * // Batch submission
 * await client.scores.batch([
 *   { traceId: "abc", name: "quality", value: 0.9 },
 *   { traceId: "def", name: "quality", value: 0.8 },
 * ]);
 * ```
 */
export class ScoresManager {
  private http: BrokleHttpClient;
  private debug: boolean;

  constructor(config: ScoresManagerConfig) {
    this.http = new BrokleHttpClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.debug = config.debug ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle ScoresManager] ${message}`, ...args);
    }
  }

  /**
   * Submit a score to a trace or span.
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
   * await client.scores.submit({
   *   traceId: "abc123",
   *   name: "quality",
   *   value: 0.9,
   *   type: ScoreType.NUMERIC,
   *   reason: "High quality response",
   * });
   *
   * // Using scorer function
   * const exact = ExactMatch({ name: "answer_match" });
   * await client.scores.submit({
   *   traceId: "abc123",
   *   scorer: exact,
   *   output: "Paris",
   *   expected: "Paris",
   * });
   * ```
   */
  async submit(options: SubmitScoreOptions): Promise<ScoreResponse | ScoreResponse[]> {
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
      return this.submitWithScorer(options);
    }

    if (!name || value === undefined) {
      // Pre-network argument error — JS-idiomatic TypeError. HTTP-layer
      // failures propagate as BrokleError subclasses from the shared
      // client; there is no per-module wrapper by design.
      throw new TypeError('scores.submit: name and value required when not using scorer');
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
   * Submit multiple scores in a batch.
   *
   * @param scores - Array of score options
   * @returns Batch result with count of created scores
   *
   * @example
   * ```typescript
   * const result = await client.scores.batch([
   *   { traceId: "abc123", name: "accuracy", value: 0.9 },
   *   { traceId: "abc123", name: "fluency", value: 0.85 },
   *   { traceId: "def456", name: "relevance", value: 0.95 },
   * ]);
   * console.log(`Created ${result.created} scores`);
   * ```
   */
  async batch(scores: BatchScoreOptions[]): Promise<BatchScoreResult> {
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

    // The HTTP client raises typed exceptions on 4xx/5xx; a
    // successful return means the raw body is the BatchScoreResult.
    return this.http.post<BatchScoreResult>('/v1/scores/batch', { scores: requests });
  }

  private async submitWithScorer(options: SubmitScoreOptions): Promise<ScoreResponse | ScoreResponse[]> {
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
      throw new TypeError('scores.submit: scorer is required for scorer mode');
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
        metadata: { ...(metadata ?? {}), scoringFailed: true, error: errorMessage },
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

    // User-provided scorer returned something we can't convert. Already
    // covered by ScorerError's contract — the scorer's contract failed.
    throw new ScorerError(
      scorerName,
      `must return ScoreResult, ScoreResult[], number, boolean, or null, got ${typeof result}`,
    );
  }

  private async submitScore(request: ScoreRequest): Promise<ScoreResponse> {
    this.log('Submitting score', { name: request.name, value: request.value });
    return this.http.post<ScoreResponse>('/v1/scores', request);
  }
}
