/**
 * LLM-as-Judge Scorer for Brokle Evaluations
 *
 * Provides LLMScorer for evaluating outputs using LLM models as judges.
 * Uses project AI credentials via the Brokle backend.
 *
 * Features:
 * - Mustache-style template variables: {{input}}, {{output}}, {{expected}}
 * - Choice scores mapping for classification tasks
 * - Chain-of-thought (CoT) reasoning option
 * - Multi-score support (single LLM call → multiple ScoreResults)
 * - Graceful error handling with scoringFailed flag
 *
 * @example
 * ```typescript
 * import { Brokle, LLMScorer } from 'brokle';
 *
 * const client = new Brokle({ apiKey: 'bk_...' });
 * const config = client.getConfig();
 *
 * // Basic numeric scorer
 * const relevance = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'relevance',
 *   prompt: `
 *     Rate the relevance of the response (0-10).
 *
 *     Question: {{input}}
 *     Response: {{output}}
 *
 *     Return JSON: {"score": <0-10>, "reason": "<explanation>"}
 *   `,
 *   model: 'gpt-4o',
 * });
 *
 * // Classification with choice scores
 * const factuality = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'factuality',
 *   prompt: `
 *     Compare factual content:
 *     Expert: {{expected}}
 *     Submission: {{output}}
 *
 *     (A) Subset (B) Superset (C) Exact (D) Contradicts
 *     Return JSON: {"choice": "<A|B|C|D>", "reason": "..."}
 *   `,
 *   choiceScores: { A: 0.4, B: 0.6, C: 1.0, D: 0.0 },
 * });
 * ```
 */

import type { Scorer, ScoreResult, ScorerArgs } from '../scores/types';
import { ScoreType } from '../scores/types';

/**
 * Model to provider mapping for automatic provider inference
 */
const MODEL_PROVIDER_MAP: Record<string, string> = {
  'gpt-4': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5': 'openai',
  o1: 'openai',
  o3: 'openai',
  'claude-3': 'anthropic',
  'claude-3-5': 'anthropic',
  'claude-3.5': 'anthropic',
  'claude-4': 'anthropic',
  gemini: 'google',
  'gemini-pro': 'google',
  'gemini-1.5': 'google',
  'gemini-2': 'google',
};

/**
 * Infer provider from model name
 */
function inferProvider(model: string): string {
  const modelLower = model.toLowerCase();
  for (const [prefix, provider] of Object.entries(MODEL_PROVIDER_MAP)) {
    if (modelLower.startsWith(prefix)) {
      return provider;
    }
  }
  return 'openai'; // default
}

/**
 * Render Mustache-style template with variables
 *
 * Supports {{variable}} syntax for template variables.
 */
function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    let strValue: string;
    if (value === null || value === undefined) {
      strValue = '';
    } else if (typeof value === 'object') {
      strValue = JSON.stringify(value, null, 2);
    } else {
      strValue = String(value);
    }

    // Replace {{key}} with value (Mustache syntax)
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, strValue);
  }
  return result;
}

/**
 * Client configuration for LLM execution
 */
export interface LLMScorerClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for API requests */
  baseUrl: string;
}

/**
 * LLM Scorer configuration options
 */
export interface LLMScorerOptions {
  /** Client configuration (apiKey and baseUrl) */
  client: LLMScorerClientConfig;

  /** Score name for results */
  name: string;

  /** Prompt template with {{input}}, {{output}}, {{expected}} variables */
  prompt: string;

  /** LLM model to use (default: "gpt-4o") */
  model?: string;

  /** Specific credential ID (optional, uses project default) */
  credentialId?: string;

  /** If true, parse response as multiple scores */
  multiScore?: boolean;

  /** Sampling temperature (default: 0.0) */
  temperature?: number;

  /** Maximum response tokens */
  maxTokens?: number;

  /** Enable chain-of-thought reasoning (default: false) */
  useCot?: boolean;

  /** Map of choice labels to scores for classification */
  choiceScores?: Record<string, number>;
}

/**
 * Backend response from playground execute
 */
interface PlaygroundResponse {
  success: boolean;
  data?: {
    response?: {
      content?: string;
    };
    error?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Execute LLM call via backend playground endpoint
 * Uses SDK route with API key auth (not dashboard route which requires JWT)
 */
async function executeLLM(
  config: LLMScorerClientConfig,
  payload: {
    template: string;
    model: string;
    provider: string;
    credentialId?: string;
    temperature: number;
    maxTokens?: number;
  }
): Promise<{ content: string }> {
  // Note: project_id is derived from API key authentication on the backend
  const requestBody = {
    template: payload.template,
    prompt_type: 'text',
    variables: {},
    config_overrides: {
      model: payload.model,
      provider: payload.provider,
      temperature: payload.temperature,
      ...(payload.credentialId && { credential_id: payload.credentialId }),
      ...(payload.maxTokens && { max_tokens: payload.maxTokens }),
    },
  };

  const response = await fetch(`${config.baseUrl}/v1/playground/execute`, {
    method: 'POST',
    headers: {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Playground execution failed (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as PlaygroundResponse;

  if (!result.success) {
    const errorMsg = result.error?.message || 'Unknown error';
    throw new Error(`Playground execution failed: ${errorMsg}`);
  }

  const content = result.data?.response?.content;
  if (!content) {
    const errorMsg = result.data?.error || 'No content in response';
    throw new Error(`Empty LLM response: ${errorMsg}`);
  }

  return { content };
}

/**
 * Parse JSON response into ScoreResult(s)
 */
function parseJsonResponse(
  parsed: Record<string, unknown>,
  scorerName: string,
  multiScore: boolean,
  choiceScores?: Record<string, number>
): ScoreResult | ScoreResult[] {
  // Extract common fields
  const reason = (parsed.reason || parsed.explanation) as string | undefined;
  const reasoning = parsed.reasoning as string | undefined;

  // Build metadata
  const metadata: Record<string, unknown> = {};
  if (reasoning) {
    metadata.reasoning = reasoning;
  }

  // 1. Check for choice scores (classification mode)
  if (choiceScores) {
    const choice = parsed.choice || parsed.label || parsed.category;
    if (choice) {
      const choiceStr = String(choice).trim().toUpperCase();
      const scoreValue =
        choiceScores[choiceStr] ?? choiceScores[choiceStr[0] ?? ''] ?? 0.0;
      metadata.choice = choiceStr;
      return {
        name: scorerName,
        value: scoreValue,
        type: ScoreType.CATEGORICAL,
        stringValue: choiceStr,
        reason,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }
  }

  // 2. Check for multi-score
  if (multiScore) {
    const results: ScoreResult[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (['reason', 'reasoning', 'explanation'].includes(key)) {
        continue;
      }
      if (typeof value === 'number') {
        results.push({
          name: key,
          value,
          type: ScoreType.NUMERIC,
          reason,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }
    }
    if (results.length > 0) {
      return results;
    }
  }

  // 3. Single score
  const scoreValue = parsed.score ?? parsed.value ?? parsed.rating;
  if (scoreValue !== undefined && scoreValue !== null) {
    const numValue = Number(scoreValue);
    if (!isNaN(numValue)) {
      return {
        name: scorerName,
        value: numValue,
        type: ScoreType.NUMERIC,
        reason,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }
  }

  // 4. Boolean result
  if ('result' in parsed && typeof parsed.result === 'boolean') {
    return {
      name: scorerName,
      value: parsed.result ? 1.0 : 0.0,
      type: ScoreType.BOOLEAN,
      reason,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  // Fallback: couldn't parse
  return {
    name: scorerName,
    value: 0,
    type: ScoreType.NUMERIC,
    reason: `Could not parse score from JSON`,
    scoringFailed: true,
    metadata: { raw_response: JSON.stringify(parsed).slice(0, 500) },
  };
}

/**
 * Parse text response (non-JSON) to extract score
 */
function parseTextResponse(content: string, scorerName: string): ScoreResult {
  // Try to extract a number
  const numbers = content.match(/\b(\d+(?:\.\d+)?)\b/g);
  const firstNumber = numbers?.[0];
  if (firstNumber) {
    let value = parseFloat(firstNumber);
    // If it looks like a 0-10 scale, normalize to 0-1
    if (value > 1.0 && value <= 10.0) {
      value = value / 10.0;
    }
    return {
      name: scorerName,
      value: Math.min(1.0, Math.max(0.0, value)),
      type: ScoreType.NUMERIC,
      reason: content.slice(0, 500),
      metadata: { raw_response: content.slice(0, 500) },
    };
  }

  // Check for yes/no
  const contentLower = content.toLowerCase();
  if (contentLower.includes('yes')) {
    return {
      name: scorerName,
      value: 1.0,
      type: ScoreType.BOOLEAN,
      reason: content.slice(0, 500),
    };
  }
  if (contentLower.includes('no')) {
    return {
      name: scorerName,
      value: 0.0,
      type: ScoreType.BOOLEAN,
      reason: content.slice(0, 500),
    };
  }

  // Fallback
  return {
    name: scorerName,
    value: 0,
    type: ScoreType.NUMERIC,
    reason: `Could not parse score from text: ${content.slice(0, 200)}`,
    scoringFailed: true,
    metadata: { raw_response: content.slice(0, 500) },
  };
}

/**
 * Parse LLM response into ScoreResult(s)
 */
function parseResponse(
  content: string,
  scorerName: string,
  multiScore: boolean,
  choiceScores?: Record<string, number>
): ScoreResult | ScoreResult[] {
  // Try to parse as JSON
  try {
    // Find JSON in content (may be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[^{}]*\}/s);
    let parsed: Record<string, unknown>;
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } else {
      parsed = JSON.parse(content) as Record<string, unknown>;
    }
    return parseJsonResponse(parsed, scorerName, multiScore, choiceScores);
  } catch {
    // Text response - try to extract a score
    return parseTextResponse(content, scorerName);
  }
}

/**
 * LLM-as-Judge scorer factory function.
 *
 * Creates a scorer that uses an LLM model to evaluate outputs.
 * Uses project AI credentials via the Brokle backend.
 *
 * @param options - LLM scorer configuration (including client config)
 * @returns Async scorer function
 *
 * @example
 * ```typescript
 * import { Brokle, LLMScorer } from 'brokle';
 *
 * const client = new Brokle({ apiKey: 'bk_...' });
 * const config = client.getConfig();
 *
 * // Basic usage in experiments
 * const relevance = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'relevance',
 *   prompt: 'Rate relevance 0-10...\n\nQuestion: {{input}}\nResponse: {{output}}',
 *   model: 'gpt-4o',
 * });
 *
 * const results = await client.experiments.run({
 *   name: 'llm-scored',
 *   dataset,
 *   task: myTask,
 *   scorers: [relevance],
 * });
 *
 * // With choice scores for classification
 * const factuality = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'factuality',
 *   prompt: 'Compare answers...',
 *   choiceScores: { A: 0.4, B: 0.6, C: 1.0, D: 0.0 },
 * });
 *
 * // With chain-of-thought reasoning
 * const safety = LLMScorer({
 *   client: { apiKey: config.apiKey, baseUrl: config.baseUrl },
 *   name: 'safety',
 *   prompt: 'Is this safe?...',
 *   useCot: true,
 * });
 * ```
 */
export function LLMScorer(options: LLMScorerOptions): Scorer {
  const {
    client: clientConfig,
    name,
    prompt,
    model = 'gpt-4o',
    credentialId,
    multiScore = false,
    temperature = 0,
    maxTokens,
    useCot = false,
    choiceScores,
  } = options;

  const provider = inferProvider(model);

  const fn = async (args: ScorerArgs): Promise<ScoreResult | ScoreResult[]> => {
    const { output, expected, input } = args;

    try {
      const variables: Record<string, unknown> = {
        input,
        output,
        expected,
      };

      let renderedPrompt = renderTemplate(prompt, variables);

      if (useCot) {
        renderedPrompt += '\n\nThink step-by-step before providing your final answer.';
      }

      const response = await executeLLM(
        {
          apiKey: clientConfig.apiKey,
          baseUrl: clientConfig.baseUrl,
        },
        {
          template: renderedPrompt,
          model,
          provider,
          credentialId,
          temperature,
          maxTokens,
        }
      );

      return parseResponse(response.content, name, multiScore, choiceScores);
    } catch (error) {
      // Graceful degradation (Optik pattern)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        name,
        value: 0,
        type: ScoreType.NUMERIC,
        reason: `LLM scoring failed: ${errorMessage}`,
        scoringFailed: true,
        metadata: { error: errorMessage },
      };
    }
  };

  // Set scorer name property for identification
  Object.defineProperty(fn, 'name', { value: name, writable: false });

  return fn as Scorer;
}
