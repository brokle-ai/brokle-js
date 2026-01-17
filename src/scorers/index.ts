/**
 * Brokle Scorers Module
 *
 * Provides built-in scorers, LLM-as-Judge scorers, pre-built evaluators, and decorators
 * for creating custom evaluation functions.
 *
 * Built-in Scorers (Heuristic):
 * - ExactMatch: Exact string comparison
 * - Contains: Substring matching
 * - RegexMatch: Regex pattern matching
 * - JSONValid: JSON validity check
 * - LengthCheck: String length validation
 *
 * LLM-as-Judge Scorers:
 * - LLMScorer: Use LLM models to evaluate outputs with project credentials
 *
 * Pre-built Evaluators (LLM-as-Judge with standardized prompts):
 *
 * Factuality:
 * - Factuality: Evaluates factual accuracy
 * - Hallucination: Detects hallucinations
 *
 * Relevance:
 * - Relevance: Evaluates response relevance
 * - AnswerRelevance: Evaluates Q&A answer relevance
 *
 * Quality:
 * - Coherence: Evaluates logical coherence
 * - Fluency: Evaluates linguistic fluency
 * - Completeness: Evaluates response completeness
 *
 * Safety:
 * - Safety: Evaluates content safety
 * - Toxicity: Detects toxic language
 *
 * RAG:
 * - ContextPrecision: RAG context precision
 * - ContextRecall: RAG context recall
 * - Faithfulness: RAG answer faithfulness
 *
 * Factory Functions:
 * - scorer(): Create custom scorers from functions
 * - multiScorer(): Create scorers that return multiple scores
 * - createEvaluator(): Create evaluators by type name
 * - listEvaluators(): List all available evaluators
 *
 * @example
 * ```typescript
 * import { Brokle } from 'brokle';
 * import { ExactMatch, Contains, LLMScorer, scorer } from 'brokle/scorers';
 * import { Factuality, Relevance } from 'brokle/scorers';
 *
 * const client = new Brokle({ apiKey: 'bk_...' });
 *
 * // Built-in scorer
 * const exact = ExactMatch({ name: "answer_match" });
 * await client.scores.submit({
 *   traceId: "abc123",
 *   scorer: exact,
 *   output: "Paris",
 *   expected: "Paris",
 * });
 *
 * // LLM-as-Judge scorer
 * const relevance = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'relevance',
 *   prompt: 'Rate relevance 0-10: {{output}}',
 *   model: 'gpt-4o',
 * });
 *
 * // Pre-built evaluator (recommended for common use cases)
 * const factuality = Factuality({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   model: 'gpt-4o',
 * });
 * const result = await factuality({
 *   output: 'Paris is the capital of France.',
 *   expected: 'What is the capital of France?',
 * });
 * console.log(`Score: ${result.value}, Reason: ${result.reason}`);
 *
 * // Custom scorer
 * const similarity = scorer("similarity", ({ output, expected }) => {
 *   return computeSimilarity(output, expected);
 * });
 * ```
 *
 * @packageDocumentation
 */

// Built-in scorers (heuristic)
export { ExactMatch, Contains, RegexMatch, JSONValid, LengthCheck } from './base';
export type {
  ExactMatchOptions,
  ContainsOptions,
  RegexMatchOptions,
  JSONValidOptions,
  LengthCheckOptions,
} from './base';

// LLM-as-Judge scorers
export { LLMScorer } from './llm-scorer';
export type { LLMScorerOptions, LLMScorerClientConfig } from './llm-scorer';

// Base evaluator and factory functions
export { createEvaluator, listEvaluators } from './base-evaluator';
export type { BaseEvaluatorOptions, EvaluatorType, CreateEvaluatorOptions } from './base-evaluator';

// Pre-built LLM evaluators - Category: Factuality
export { Factuality, Hallucination } from './factuality';

// Pre-built LLM evaluators - Category: Relevance
export { Relevance, AnswerRelevance } from './relevance';

// Pre-built LLM evaluators - Category: Quality
export { Coherence, Fluency, Completeness } from './quality';

// Pre-built LLM evaluators - Category: Safety
export { Safety, Toxicity } from './safety';

// Pre-built LLM evaluators - Category: RAG
export { ContextPrecision, ContextRecall, Faithfulness } from './rag';

// Factory functions
export { scorer, multiScorer } from './decorator';
export type { ScorerFunction, MultiScorerFunction } from './decorator';

// Re-export types for convenience in custom scorers
export type { ScoreResult, ScoreValue, Scorer, ScorerArgs } from '../scores/types';
export { ScoreType } from '../scores/types';
