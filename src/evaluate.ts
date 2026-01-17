/**
 * Top-Level Evaluate Function
 *
 * Provides a simplified interface for running evaluations, following the pattern
 * used by Braintrust, LangSmith, and other competitors.
 *
 * This is a convenience wrapper that:
 * 1. Gets or creates a Brokle client singleton
 * 2. Creates a dataset if needed (from list of dicts)
 * 3. Runs the experiment with the provided evaluators
 * 4. Returns comprehensive results
 *
 * @example
 * ```typescript
 * import { evaluate } from 'brokle';
 * import { Factuality, Relevance } from 'brokle/scorers';
 *
 * // With a dataset object
 * const results = await evaluate({
 *   task: (item) => callLLM(item.question),
 *   data: dataset,
 *   evaluators: [Factuality(), Relevance()],
 *   experimentName: 'gpt-4o-v2',
 * });
 *
 * // With raw data
 * const results = await evaluate({
 *   task: (item) => callLLM(item.question),
 *   data: [
 *     { input: { question: 'What is 2+2?' }, expected: { answer: '4' } },
 *     { input: { question: 'Capital of France?' }, expected: { answer: 'Paris' } },
 *   ],
 *   evaluators: [Factuality()],
 *   experimentName: 'qa-test',
 * });
 *
 * // With key mapping
 * const results = await evaluate({
 *   task: (item) => callLLM(item.prompt),
 *   data: dataset,
 *   evaluators: [Relevance()],
 *   experimentName: 'mapped-test',
 *   scoringKeyMapping: { input: 'prompt', output: 'response' },
 * });
 * ```
 *
 * @packageDocumentation
 */

import { getClient } from './client';
import type { Dataset } from './datasets';
import type { DatasetItemInput } from './datasets/types';
import type { EvaluationResults, TaskFunction, ProgressCallback } from './experiments/types';
import type { ScoreValue, Scorer, ScorerArgs } from './scores/types';

/**
 * Key mapping for scorer arguments.
 *
 * Maps scorer parameter names to actual data field names.
 * For example: { output: 'response' } means the scorer's 'output'
 * will receive the data's 'response' field.
 */
export interface ScoringKeyMapping {
  /** Map scorer's 'input' to a different field name */
  input?: string;
  /** Map scorer's 'output' to a different field name */
  output?: string;
  /** Map scorer's 'expected' to a different field name */
  expected?: string;
}

/**
 * Options for the evaluate() function
 */
export interface EvaluateOptions {
  /**
   * Task function that takes an input dict and returns an output.
   * The input dict comes from dataset items.
   *
   * @example
   * ```typescript
   * task: (item) => callLLM(item.question)
   * task: async (item) => {
   *   const response = await openai.chat.completions.create({...});
   *   return response.choices[0].message.content;
   * }
   * ```
   */
  task: TaskFunction;

  /**
   * The data to evaluate. Can be:
   * - A Dataset object
   * - A dataset ID string
   * - A list of objects with format: [{ input: {...}, expected: {...} }, ...]
   */
  data: Dataset | string | Array<Record<string, unknown>>;

  /**
   * List of scorers/evaluators to run on each item.
   * Can be built-in scorers (ExactMatch, Contains) or
   * pre-built evaluators (Factuality, Relevance).
   */
  evaluators: Scorer[];

  /**
   * Name for the experiment.
   * If not provided, a name will be auto-generated.
   */
  experimentName?: string;

  /**
   * Maximum parallel task executions.
   * @default 10
   */
  maxConcurrency?: number;

  /**
   * Number of times to run each item.
   * @default 1
   */
  trialCount?: number;

  /**
   * Optional experiment metadata.
   */
  metadata?: Record<string, unknown>;

  /**
   * Optional dict to remap keys for scorers.
   *
   * @example
   * ```typescript
   * // Maps scorer's 'output' to data's 'response' field
   * scoringKeyMapping: { output: 'response', input: 'prompt' }
   * ```
   */
  scoringKeyMapping?: ScoringKeyMapping;

  /**
   * Optional progress callback: (completed, total) => void
   */
  onProgress?: ProgressCallback;

  /**
   * Optional API key (uses BROKLE_API_KEY if not provided)
   */
  apiKey?: string;

  /**
   * Optional base URL (uses BROKLE_BASE_URL if not provided)
   */
  baseUrl?: string;
}

/**
 * Create a key mapping wrapper around a scorer.
 *
 * This wraps a scorer to remap keys before passing to the underlying scorer,
 * allowing evaluators to work with different field names in the data.
 *
 * @param scorer - The underlying scorer to wrap
 * @param mapping - Dict mapping scorer keys to data keys
 * @returns A new scorer with key mapping applied
 *
 * @example
 * ```typescript
 * const relevanceScorer = Relevance();
 * const mappedScorer = createKeyMappingScorer(relevanceScorer, {
 *   output: 'response',  // scorer's 'output' receives data's 'response'
 *   input: 'prompt',     // scorer's 'input' receives data's 'prompt'
 * });
 * ```
 */
export function createKeyMappingScorer(
  scorer: Scorer,
  mapping: ScoringKeyMapping
): Scorer {
  const wrappedScorer = (args: ScorerArgs): ScoreValue | Promise<ScoreValue> => {
    // Get input as a record for key access
    const inputRecord = (args.input ?? {}) as Record<string, unknown>;

    // Remap the main arguments if specified
    let actualOutput = args.output;
    let actualExpected = args.expected;
    let actualInput: Record<string, unknown> | undefined = args.input as Record<string, unknown> | undefined;

    if (mapping.output && mapping.output in inputRecord) {
      actualOutput = inputRecord[mapping.output];
    }

    if (mapping.expected && mapping.expected in inputRecord) {
      actualExpected = inputRecord[mapping.expected];
    }

    if (mapping.input && mapping.input in inputRecord) {
      actualInput = { [mapping.input]: inputRecord[mapping.input] };
    }

    return scorer({
      output: actualOutput,
      expected: actualExpected,
      input: actualInput,
    });
  };

  // Preserve the name from the underlying scorer
  wrappedScorer.name = scorer.name || 'unnamed_scorer';

  return wrappedScorer as Scorer;
}

/**
 * @deprecated Use createKeyMappingScorer function instead.
 * This class is kept for backwards compatibility.
 */
export const KeyMappingScorer = {
  /**
   * Create a key mapping wrapper around a scorer.
   * @deprecated Use createKeyMappingScorer function instead.
   */
  create: createKeyMappingScorer,
};

/**
 * Wrap scorers with key mapping if a mapping is provided.
 */
function wrapScorersWithMapping(
  scorers: Scorer[],
  mapping?: ScoringKeyMapping
): Scorer[] {
  if (!mapping) {
    return scorers;
  }

  return scorers.map((scorer) => createKeyMappingScorer(scorer, mapping));
}

/**
 * Convert raw data dicts to DatasetItemInput format.
 *
 * Expected format for each item:
 * - { input: {...}, expected: {...}, metadata: {...} }
 * - or just { input: {...} }
 */
function createTempDatasetItems(
  data: Array<Record<string, unknown>>
): DatasetItemInput[] {
  return data.map((item) => {
    if ('input' in item) {
      // Standard format
      return {
        input: item.input as Record<string, unknown>,
        expected: item.expected as Record<string, unknown> | undefined,
        metadata: item.metadata as Record<string, unknown> | undefined,
      };
    } else {
      // Treat entire dict as input
      return { input: item };
    }
  });
}

/**
 * Generate a random hex string for experiment names.
 */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Run an evaluation experiment with a simple, high-level interface.
 *
 * This function provides a convenient way to run evaluations, similar to
 * Braintrust's Eval() and LangSmith's evaluate() functions.
 *
 * @param options - Evaluation options
 * @returns EvaluationResults with:
 *   - experimentId: ID of the created experiment
 *   - experimentName: Name of the experiment
 *   - summary: Dict of scorer name -> SummaryStats (mean, stdDev, etc.)
 *   - items: List of EvaluationItem results
 *   - url: Dashboard URL to view the experiment
 *
 * @example
 * ```typescript
 * import { evaluate } from 'brokle';
 * import { Factuality, Relevance } from 'brokle/scorers';
 *
 * // Define your task
 * async function myTask(item: Record<string, unknown>) {
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     messages: [{ role: 'user', content: item.question as string }],
 *   });
 *   return response.choices[0].message.content;
 * }
 *
 * // Run evaluation
 * const results = await evaluate({
 *   task: myTask,
 *   data: dataset,
 *   evaluators: [Factuality(), Relevance()],
 *   experimentName: 'gpt-4o-qa-test',
 *   maxConcurrency: 5,
 * });
 *
 * // View results
 * console.log(`Experiment: ${results.experimentName}`);
 * for (const [name, stats] of Object.entries(results.summary)) {
 *   console.log(`  ${name}: mean=${stats.mean.toFixed(3)}`);
 * }
 * console.log(`View at: ${results.url}`);
 * ```
 *
 * Note:
 *   This function uses getClient() internally to get or create a Brokle
 *   client singleton. If you need more control, use client.experiments.run()
 *   directly.
 */
export async function evaluate(options: EvaluateOptions): Promise<EvaluationResults> {
  const {
    task,
    data,
    evaluators,
    experimentName,
    maxConcurrency = 10,
    trialCount = 1,
    metadata,
    scoringKeyMapping,
    onProgress,
    apiKey,
    baseUrl,
  } = options;

  // Get or create client
  const clientConfig: Record<string, unknown> = {};
  if (apiKey) clientConfig.apiKey = apiKey;
  if (baseUrl) clientConfig.baseUrl = baseUrl;

  const client = getClient(Object.keys(clientConfig).length > 0 ? clientConfig : undefined);

  // Generate experiment name if not provided
  const resolvedExperimentName = experimentName ?? `eval-${randomHex(8)}`;

  // Wrap scorers with key mapping if needed
  const wrappedScorers = wrapScorersWithMapping(evaluators, scoringKeyMapping);

  // Handle different data types
  let resolvedData: Dataset | string;

  if (Array.isArray(data)) {
    // Raw data - create a temporary dataset
    const datasetName = `temp-${randomHex(8)}`;
    const dataset = await client.datasets.create({
      name: datasetName,
      description: `Temporary dataset for ${resolvedExperimentName}`,
      metadata: { temporary: true, experiment: resolvedExperimentName },
    });

    // Insert items
    const items = createTempDatasetItems(data);
    await dataset.insert(items);

    resolvedData = dataset;
  } else {
    resolvedData = data;
  }

  // Run the experiment
  return client.experiments.run({
    name: resolvedExperimentName,
    dataset: resolvedData,
    task,
    scorers: wrappedScorers,
    maxConcurrency,
    trialCount,
    metadata,
    onProgress,
  });
}

export default evaluate;
