/**
 * Base Evaluator Types and Factory Functions
 *
 * Provides the base configuration and factory functions for creating
 * pre-built LLM evaluators.
 *
 * @packageDocumentation
 */

import { LLMScorer } from './llm-scorer';
import type { LLMScorerClientConfig } from './llm-scorer';
import type { Scorer } from '../scores/types';

/**
 * Base configuration for all evaluators
 */
export interface BaseEvaluatorOptions {
  /** Client configuration (apiKey and baseUrl) */
  client: LLMScorerClientConfig;
  /** Custom name for the score (default: evaluator-specific) */
  name?: string;
  /** LLM model to use (default: "gpt-4o") */
  model?: string;
  /** Specific credential ID (optional, uses project default) */
  credentialId?: string;
  /** Sampling temperature (default: 0.0 for deterministic) */
  temperature?: number;
  /** Use chain-of-thought reasoning (default: true for explainability) */
  useCot?: boolean;
}

/**
 * Create an evaluator with the given options and prompt
 * @internal
 */
export function createEvaluatorFromPrompt(
  options: BaseEvaluatorOptions,
  defaultName: string,
  prompt: string
): Scorer {
  return LLMScorer({
    client: options.client,
    name: options.name ?? defaultName,
    prompt,
    model: options.model ?? 'gpt-4o',
    credentialId: options.credentialId,
    temperature: options.temperature ?? 0.0,
    useCot: options.useCot ?? true,
  });
}

/**
 * Evaluator type string for factory function
 */
export type EvaluatorType =
  | 'factuality'
  | 'hallucination'
  | 'relevance'
  | 'answer_relevance'
  | 'answerRelevance'
  | 'coherence'
  | 'fluency'
  | 'completeness'
  | 'safety'
  | 'toxicity'
  | 'context_precision'
  | 'contextPrecision'
  | 'context_recall'
  | 'contextRecall'
  | 'faithfulness';

/**
 * Options for createEvaluator factory function
 */
export interface CreateEvaluatorOptions extends BaseEvaluatorOptions {
  /** Type of evaluator to create */
  type: EvaluatorType;
}

/**
 * Factory function to create evaluators by name.
 *
 * @param options - Evaluator configuration including type
 * @returns Configured evaluator instance
 *
 * @example
 * ```typescript
 * const evaluator = createEvaluator({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   type: 'factuality',
 *   model: 'gpt-4o',
 * });
 * ```
 */
export function createEvaluator(options: CreateEvaluatorOptions): Scorer {
  const { type, ...baseOptions } = options;

  // Normalize type to lowercase with underscores
  const normalizedType = type.toLowerCase().replace(/-/g, '_');

  // Import evaluators lazily to avoid circular imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Factuality, Hallucination } = require('./factuality');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Relevance, AnswerRelevance } = require('./relevance');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Coherence, Fluency, Completeness } = require('./quality');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Safety, Toxicity } = require('./safety');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContextPrecision, ContextRecall, Faithfulness } = require('./rag');

  // Map types to evaluator constructors
  const evaluatorMap: Record<string, (opts: BaseEvaluatorOptions) => Scorer> = {
    factuality: Factuality,
    hallucination: Hallucination,
    relevance: Relevance,
    answer_relevance: AnswerRelevance,
    answerrelevance: AnswerRelevance,
    coherence: Coherence,
    fluency: Fluency,
    completeness: Completeness,
    safety: Safety,
    toxicity: Toxicity,
    context_precision: ContextPrecision,
    contextprecision: ContextPrecision,
    context_recall: ContextRecall,
    contextrecall: ContextRecall,
    faithfulness: Faithfulness,
  };

  const evaluatorFn = evaluatorMap[normalizedType];
  if (!evaluatorFn) {
    const available = Object.keys(evaluatorMap)
      .filter((k) => !k.includes('_') || k === 'answer_relevance' || k === 'context_precision' || k === 'context_recall')
      .join(', ');
    throw new Error(`Unknown evaluator type: ${type}. Available evaluators: ${available}`);
  }

  return evaluatorFn(baseOptions);
}

/**
 * List all available pre-built evaluators with descriptions.
 *
 * @returns Object mapping evaluator names to their descriptions
 *
 * @example
 * ```typescript
 * for (const [name, desc] of Object.entries(listEvaluators())) {
 *   console.log(`${name}: ${desc}`);
 * }
 * ```
 */
export function listEvaluators(): Record<string, string> {
  return {
    factuality: 'Measures factual accuracy of the output',
    hallucination: 'Detects unsupported or fabricated information',
    relevance: 'Measures how relevant the output is to the input',
    answerRelevance: 'Measures how well the answer addresses the question',
    coherence: 'Measures logical flow and clarity of the output',
    fluency: 'Measures grammatical correctness and readability',
    completeness: 'Measures whether all aspects of the request are addressed',
    safety: 'Measures whether the output is safe and appropriate',
    toxicity: 'Detects toxic or offensive language',
    contextPrecision: 'Measures precision of retrieved context for RAG',
    contextRecall: 'Measures recall/coverage of retrieved context for RAG',
    faithfulness: 'Measures faithfulness of answer to source context',
  };
}
