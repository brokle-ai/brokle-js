/**
 * Experiments Module
 *
 * Manager for running evaluation experiments against datasets.
 *
 * @example
 * ```typescript
 * import { getClient } from 'brokle';
 * import { ExactMatch, Contains } from 'brokle/scorers';
 *
 * const client = getClient();
 * const dataset = await client.datasets.get("01HXYZ...");
 *
 * const results = await client.experiments.run({
 *   name: "my-evaluation",
 *   dataset,
 *   task: async (input) => callLLM(input.prompt),
 *   scorers: [ExactMatch(), Contains()],
 * });
 *
 * console.log(results.summary);
 * ```
 *
 * @packageDocumentation
 */

// Manager
export { ExperimentsManager } from './manager';

// Types
export type {
  ExperimentsManagerConfig,
  Experiment,
  EvaluationResults,
  EvaluationItem,
  SummaryStats,
  RunOptions,
  ListExperimentsOptions,
  TaskFunction,
  ProgressCallback,
} from './types';

// Errors
export { EvaluationError, TaskError, ScorerExecutionError } from './errors';
