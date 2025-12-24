/**
 * Experiments Module
 *
 * Manager for running evaluation experiments against datasets or production spans.
 *
 * @example
 * ```typescript
 * import { getClient } from 'brokle';
 * import { ExactMatch, Contains } from 'brokle/scorers';
 *
 * const client = getClient();
 *
 * // Dataset-based evaluation (traditional)
 * const dataset = await client.datasets.get("01HXYZ...");
 * const results = await client.experiments.run({
 *   name: "my-evaluation",
 *   dataset,
 *   task: async (input) => callLLM(input.prompt),
 *   scorers: [ExactMatch(), Contains()],
 * });
 *
 * // Span-based evaluation (THE WEDGE)
 * const queryResult = await client.query.query({
 *   filter: 'service.name=chatbot AND gen_ai.system=openai',
 * });
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
  SpanExtractInput,
  SpanExtractOutput,
  SpanExtractExpected,
} from './types';

// Errors
export { EvaluationError, TaskError, ScorerExecutionError } from './errors';
