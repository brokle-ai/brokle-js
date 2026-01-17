/**
 * Experiments Manager
 *
 * Manager for running evaluation experiments against datasets or production spans.
 */

import type { ScoreResult, Scorer, ScorerArgs } from '../scores/types';
import { ScoreType } from '../scores/types';
import type { Dataset } from '../datasets';
import type { DatasetItem } from '../datasets/types';
import { DatasetsManager } from '../datasets/manager';
import { EvaluationError } from './errors';
import type { QueriedSpan } from '../query';
import type {
  ExperimentsManagerConfig,
  RunOptions,
  ListExperimentsOptions,
  Experiment,
  EvaluationResults,
  EvaluationItem,
  SummaryStats,
  APIResponse,
  ExperimentData,
  SubmitItemData,
} from './types';

/**
 * Get scorer name from Scorer
 */
function getScorerName(scorer: Scorer): string {
  return scorer.name || 'unnamed_scorer';
}

/**
 * Normalize scorer result to ScoreResult
 */
function normalizeScoreResult(
  scorerName: string,
  result: number | boolean | ScoreResult | ScoreResult[] | null
): ScoreResult[] {
  if (result === null) {
    return [];
  }

  if (typeof result === 'number') {
    return [{ name: scorerName, value: result, type: ScoreType.NUMERIC }];
  }

  if (typeof result === 'boolean') {
    return [{ name: scorerName, value: result ? 1 : 0, type: ScoreType.BOOLEAN }];
  }

  if (Array.isArray(result)) {
    return result;
  }

  return [result];
}

/**
 * Run a single scorer safely, catching errors
 */
async function runScorerSafe(
  scorer: Scorer,
  args: ScorerArgs
): Promise<ScoreResult[]> {
  const scorerName = getScorerName(scorer);

  try {
    const result = await Promise.resolve(scorer(args));
    return normalizeScoreResult(scorerName, result);
  } catch (error) {
    // Return a failed score result
    return [
      {
        name: scorerName,
        value: 0,
        type: ScoreType.NUMERIC,
        scoringFailed: true,
        reason: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

/**
 * Compute summary statistics for evaluation results
 */
function computeSummary(items: EvaluationItem[]): Record<string, SummaryStats> {
  const summary: Record<string, SummaryStats> = {};

  // Collect scores by name
  const scoresByName: Record<string, ScoreResult[]> = {};

  for (const item of items) {
    for (const score of item.scores) {
      const scoreName = score.name;
      if (!scoresByName[scoreName]) {
        scoresByName[scoreName] = [];
      }
      scoresByName[scoreName]!.push(score);
    }
  }

  // Compute stats for each scorer
  for (const [name, scores] of Object.entries(scoresByName)) {
    const successfulValues = scores
      .filter((s) => !s.scoringFailed)
      .map((s) => s.value);

    const total = scores.length;
    const passed = successfulValues.length;

    if (successfulValues.length > 0) {
      const mean = successfulValues.reduce((a, b) => a + b, 0) / successfulValues.length;
      const min = Math.min(...successfulValues);
      const max = Math.max(...successfulValues);

      // Calculate standard deviation
      let stdDev = 0;
      if (successfulValues.length > 1) {
        const squaredDiffs = successfulValues.map((v) => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (successfulValues.length - 1);
        stdDev = Math.sqrt(variance);
      }

      summary[name] = {
        mean,
        stdDev,
        min,
        max,
        count: total,
        passRate: total > 0 ? passed / total : 0,
      };
    } else {
      // All scores failed
      summary[name] = {
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        count: total,
        passRate: 0,
      };
    }
  }

  return summary;
}

/**
 * Transform API experiment data to Experiment type
 */
function toExperiment(data: ExperimentData): Experiment {
  return {
    id: data.id,
    name: data.name,
    datasetId: data.dataset_id,
    status: data.status as 'running' | 'completed' | 'failed',
    metadata: data.metadata,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Experiments API manager
 *
 * Provides methods for running and managing evaluation experiments.
 *
 * @example
 * ```typescript
 * // Run an experiment
 * const results = await client.experiments.run({
 *   name: "gpt4-test",
 *   dataset,
 *   task: myTask,
 *   scorers: [ExactMatch()],
 * });
 *
 * // View results
 * console.log(results.summary);
 * console.log(results.url);
 *
 * // Get existing experiment
 * const exp = await client.experiments.get("01HXYZ...");
 *
 * // List experiments
 * const experiments = await client.experiments.list();
 * ```
 */
export class ExperimentsManager {
  private baseUrl: string;
  private apiKey: string;
  private debug: boolean;
  private datasetsManager: DatasetsManager;

  constructor(config: ExperimentsManagerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.debug = config.debug ?? false;
    this.datasetsManager = new DatasetsManager(config);
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Brokle ExperimentsManager] ${message}`, ...args);
    }
  }

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
      throw new EvaluationError(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private async httpGet<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new EvaluationError(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private async httpPatch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new EvaluationError(`API request failed (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private unwrapResponse<T>(response: APIResponse<T>): T {
    if (!response.success) {
      const error = response.error;
      if (!error) {
        throw new EvaluationError('Request failed with no error details');
      }
      throw new EvaluationError(`${error.code}: ${error.message}`);
    }

    if (response.data === undefined) {
      throw new EvaluationError('Response missing data field');
    }

    return response.data;
  }

  /**
   * Run an evaluation experiment.
   *
   * Supports two modes:
   * - **Dataset-based**: Provide `dataset` and `task` to run task on each item
   * - **Span-based** (THE WEDGE): Provide `spans`, `extractInput`, `extractOutput`
   *   to evaluate existing production telemetry
   *
   * @param options - Experiment options
   * @returns Evaluation results with summary statistics
   *
   * @example
   * ```typescript
   * // Dataset-based evaluation
   * const results = await client.experiments.run({
   *   name: "my-evaluation",
   *   dataset,
   *   task: async (input) => callLLM(input.prompt),
   *   scorers: [ExactMatch(), Contains()],
   * });
   *
   * // Span-based evaluation (THE WEDGE)
   * const spanResults = await client.experiments.run({
   *   name: "retrospective-analysis",
   *   spans: queryResult.spans,
   *   extractInput: (span) => ({ prompt: span.input }),
   *   extractOutput: (span) => span.output,
   *   scorers: [Relevance()],
   * });
   *
   * console.log(results.summary);
   * ```
   */
  async run(options: RunOptions): Promise<EvaluationResults> {
    // Validate: dataset XOR spans
    if (options.dataset && options.spans) {
      throw new EvaluationError('Cannot specify both dataset and spans - choose one mode');
    }

    if (!options.dataset && !options.spans) {
      throw new EvaluationError('Must specify either dataset or spans');
    }

    // Span-based validation
    if (options.spans) {
      if (!options.extractInput) {
        throw new EvaluationError('extractInput is required when using spans');
      }
      if (!options.extractOutput) {
        throw new EvaluationError('extractOutput is required when using spans');
      }
      return this.runSpanBased(options);
    }

    // Dataset-based validation
    if (!options.task) {
      throw new EvaluationError('task is required when using dataset');
    }

    return this.runDatasetBased(options);
  }

  /**
   * Run span-based evaluation (THE WEDGE)
   *
   * Evaluates production spans without re-executing tasks.
   */
  private async runSpanBased(options: RunOptions): Promise<EvaluationResults> {
    const {
      name,
      spans,
      extractInput,
      extractOutput,
      extractExpected,
      scorers,
      maxConcurrency = 10,
      metadata,
      onProgress,
    } = options;

    if (!spans || !extractInput || !extractOutput) {
      throw new EvaluationError('spans, extractInput, and extractOutput are required');
    }

    this.log('Starting span-based experiment', { name, spanCount: spans.length, maxConcurrency });

    if (spans.length === 0) {
      this.log('Empty spans, returning empty results');
      return {
        experimentId: '',
        experimentName: name,
        source: 'spans',
        summary: {},
        items: [],
      };
    }

    // Create experiment via API (without dataset_id for span-based)
    const createResponse = await this.httpPost<APIResponse<ExperimentData>>(
      '/v1/experiments',
      {
        name,
        metadata: {
          ...metadata,
          source: 'spans',
          span_count: spans.length,
        },
      }
    );
    const experimentData = this.unwrapResponse(createResponse);
    const experimentId = experimentData.id;

    this.log('Created experiment', { experimentId });

    const totalItems = spans.length;
    let completedItems = 0;
    const evaluationItems: EvaluationItem[] = [];

    // Process span
    const processSpan = async (span: QueriedSpan): Promise<EvaluationItem> => {
      let input: Record<string, unknown>;
      let output: unknown;
      let expected: unknown;
      let extractionError: string | undefined;

      // Extract input, output, expected
      try {
        input = extractInput(span);
        output = extractOutput(span);
        expected = extractExpected ? extractExpected(span) : undefined;
      } catch (error) {
        extractionError = error instanceof Error ? error.message : String(error);
        completedItems++;
        if (onProgress) {
          onProgress(completedItems, totalItems);
        }

        return {
          spanId: span.spanId,
          input: {},
          output: null,
          scores: [],
          trialNumber: 1,
          error: `Extraction failed: ${extractionError}`,
        };
      }

      // Run scorers
      const scorerArgs: ScorerArgs = {
        output,
        expected,
        input,
      };

      const allScores: ScoreResult[] = [];
      for (const scorer of scorers) {
        const results = await runScorerSafe(scorer, scorerArgs);
        allScores.push(...results);
      }

      completedItems++;
      if (onProgress) {
        onProgress(completedItems, totalItems);
      }

      return {
        spanId: span.spanId,
        input,
        output,
        expected,
        scores: allScores,
        trialNumber: 1,
      };
    };

    // Execute with concurrency limit
    const executing: Promise<void>[] = [];
    for (const span of spans) {
      const p = processSpan(span).then((result) => {
        evaluationItems.push(result);
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);

    // Submit items to API
    const submitItems: SubmitItemData[] = evaluationItems.map((ei) => ({
      dataset_item_id: ei.spanId || '', // Use spanId as identifier
      input: ei.input,
      output: ei.output,
      expected: ei.expected,
      scores: ei.scores.map((s) => ({
        name: s.name,
        value: s.value,
        type: s.type,
        string_value: s.stringValue,
        reason: s.reason,
        scoring_failed: s.scoringFailed,
        metadata: s.metadata,
      })),
      trial_number: ei.trialNumber,
      error: ei.error,
    }));

    await this.httpPost<APIResponse<unknown>>(`/v1/experiments/${experimentId}/items`, {
      items: submitItems,
    });

    // Update experiment status
    await this.httpPatch<APIResponse<unknown>>(`/v1/experiments/${experimentId}`, {
      status: 'completed',
    });

    // Compute summary
    const summary = computeSummary(evaluationItems);

    this.log('Span-based experiment completed', { experimentId, itemCount: evaluationItems.length });

    return {
      experimentId,
      experimentName: name,
      source: 'spans',
      url: `${this.baseUrl.replace('/api', '')}/experiments/${experimentId}`,
      summary,
      items: evaluationItems,
    };
  }

  /**
   * Run dataset-based evaluation (traditional mode)
   */
  private async runDatasetBased(options: RunOptions): Promise<EvaluationResults> {
    const {
      name,
      dataset: datasetOrId,
      task,
      scorers,
      maxConcurrency = 10,
      trialCount = 1,
      metadata,
      onProgress,
    } = options;

    if (!datasetOrId || !task) {
      throw new EvaluationError('dataset and task are required for dataset-based evaluation');
    }

    this.log('Starting dataset-based experiment', { name, maxConcurrency, trialCount });

    // 1. Resolve dataset
    let dataset: Dataset;
    if (typeof datasetOrId === 'string') {
      dataset = await this.datasetsManager.get(datasetOrId);
    } else {
      dataset = datasetOrId;
    }

    const datasetId = dataset.id;

    // 2. Collect all items from dataset
    const items: DatasetItem[] = [];
    for await (const item of dataset) {
      items.push(item);
    }

    if (items.length === 0) {
      this.log('Empty dataset, returning empty results');
      return {
        experimentId: '',
        experimentName: name,
        datasetId,
        source: 'dataset',
        summary: {},
        items: [],
      };
    }

    // 3. Create experiment via API
    const createResponse = await this.httpPost<APIResponse<ExperimentData>>(
      '/v1/experiments',
      {
        name,
        dataset_id: datasetId,
        metadata,
      }
    );
    const experimentData = this.unwrapResponse(createResponse);
    const experimentId = experimentData.id;

    this.log('Created experiment', { experimentId });

    // 4. Flatten items with trials
    interface WorkItem {
      item: DatasetItem;
      trialNumber: number;
    }
    const workItems: WorkItem[] = [];
    for (const item of items) {
      for (let trial = 1; trial <= trialCount; trial++) {
        workItems.push({ item, trialNumber: trial });
      }
    }

    const totalItems = workItems.length;
    let completedItems = 0;

    // 5. Process items with concurrency control
    const evaluationItems: EvaluationItem[] = [];

    // Promise pool for concurrency control
    const processWorkItem = async (workItem: WorkItem): Promise<EvaluationItem> => {
      const { item, trialNumber } = workItem;

      let output: unknown;
      let taskError: string | undefined;

      // Run task
      try {
        output = await Promise.resolve(task(item.input));
      } catch (error) {
        taskError = error instanceof Error ? error.message : String(error);
        output = null;
      }

      // Skip scoring if task failed
      if (taskError) {
        completedItems++;
        if (onProgress) {
          onProgress(completedItems, totalItems);
        }

        return {
          datasetItemId: item.id,
          input: item.input,
          output: null,
          expected: item.expected,
          scores: [],
          trialNumber,
          error: taskError,
        };
      }

      // Run scorers (only if task succeeded)
      const scorerArgs: ScorerArgs = {
        output,
        expected: item.expected,
        input: item.input,
      };

      const allScores: ScoreResult[] = [];
      for (const scorer of scorers) {
        const results = await runScorerSafe(scorer, scorerArgs);
        allScores.push(...results);
      }

      completedItems++;
      if (onProgress) {
        onProgress(completedItems, totalItems);
      }

      return {
        datasetItemId: item.id,
        input: item.input,
        output,
        expected: item.expected,
        scores: allScores,
        trialNumber,
      };
    };

    // Execute with concurrency limit
    const executing: Promise<void>[] = [];
    for (const workItem of workItems) {
      const p = processWorkItem(workItem).then((result) => {
        evaluationItems.push(result);
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining
    await Promise.all(executing);

    // 6. Submit items to API
    const submitItems: SubmitItemData[] = evaluationItems.map((ei) => ({
      dataset_item_id: ei.datasetItemId || '',
      input: ei.input,
      output: ei.output,
      expected: ei.expected,
      scores: ei.scores.map((s) => ({
        name: s.name,
        value: s.value,
        type: s.type,
        string_value: s.stringValue,
        reason: s.reason,
        scoring_failed: s.scoringFailed,
        metadata: s.metadata,
      })),
      trial_number: ei.trialNumber,
      error: ei.error,
    }));

    await this.httpPost<APIResponse<unknown>>(`/v1/experiments/${experimentId}/items`, {
      items: submitItems,
    });

    // 7. Update experiment status
    await this.httpPatch<APIResponse<unknown>>(`/v1/experiments/${experimentId}`, {
      status: 'completed',
    });

    // 8. Compute summary
    const summary = computeSummary(evaluationItems);

    this.log('Dataset-based experiment completed', { experimentId, itemCount: evaluationItems.length });

    // 9. Return results
    return {
      experimentId,
      experimentName: name,
      datasetId,
      source: 'dataset',
      url: `${this.baseUrl.replace('/api', '')}/experiments/${experimentId}`,
      summary,
      items: evaluationItems,
    };
  }

  /**
   * Get an existing experiment by ID.
   *
   * @param experimentId - The experiment ID (ULID format)
   * @returns Experiment metadata
   *
   * @example
   * ```typescript
   * const experiment = await client.experiments.get("01HXYZ...");
   * console.log(experiment.status);
   * ```
   */
  async get(experimentId: string): Promise<Experiment> {
    this.log('Getting experiment', { id: experimentId });

    const rawResponse = await this.httpGet<APIResponse<ExperimentData>>(
      `/v1/experiments/${experimentId}`
    );
    const data = this.unwrapResponse(rawResponse);

    return toExperiment(data);
  }

  /**
   * List all experiments.
   *
   * @param options - Pagination options (limit, page)
   * @returns Array of Experiment metadata
   *
   * @example
   * ```typescript
   * const experiments = await client.experiments.list({ limit: 10 });
   * for (const exp of experiments) {
   *   console.log(exp.name, exp.status);
   * }
   * ```
   */
  async list(options: ListExperimentsOptions = {}): Promise<Experiment[]> {
    const { limit = 50, page = 1 } = options;

    this.log('Listing experiments', { limit, page });

    const rawResponse = await this.httpGet<APIResponse<ExperimentData[]>>(
      '/v1/experiments',
      { limit, page }
    );

    const data = this.unwrapResponse(rawResponse);

    return data.map(toExperiment);
  }
}
