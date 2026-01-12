/**
 * Tests for LLMScorer - LLM-as-Judge scorer using project AI credentials.
 *
 * Testing patterns:
 * - Mock fetch, test parsing separately from LLM calls
 * - Validate graceful degradation (scoringFailed=true, never throw)
 * - Test all response parsing modes (JSON, text, choice scores, multi-score)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMScorer } from '../llm-scorer';
import { ScoreType, type ScoreResult } from '../../scores/types';

// =============================================================================
// Test Utilities
// =============================================================================

const mockFetch = vi.fn();

/**
 * Type guard for ScoreResult - LLMScorer always returns ScoreResult | ScoreResult[]
 */
function isScoreResult(val: unknown): val is ScoreResult {
  return (
    val !== null &&
    typeof val === 'object' &&
    'name' in val &&
    'value' in val &&
    typeof (val as ScoreResult).name === 'string' &&
    typeof (val as ScoreResult).value === 'number'
  );
}

/**
 * Assert and cast result to ScoreResult (throws if not valid)
 */
function asScoreResult(result: unknown): ScoreResult {
  if (Array.isArray(result)) {
    throw new Error('Expected single ScoreResult, got array');
  }
  if (!isScoreResult(result)) {
    throw new Error(`Expected ScoreResult, got: ${JSON.stringify(result)}`);
  }
  return result;
}

/**
 * Assert and cast result to ScoreResult[] (throws if not valid)
 */
function asScoreResultArray(result: unknown): ScoreResult[] {
  if (!Array.isArray(result)) {
    throw new Error('Expected ScoreResult[], got non-array');
  }
  for (const item of result) {
    if (!isScoreResult(item)) {
      throw new Error(`Expected ScoreResult in array, got: ${JSON.stringify(item)}`);
    }
  }
  return result as ScoreResult[];
}

function makeSuccessResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        response: { content },
      },
    }),
  };
}

function makeErrorResponse(message = 'Unknown error') {
  return {
    ok: false,
    status: 500,
    text: async () => message,
  };
}

function makeApiErrorResponse(message = 'Unknown error') {
  return {
    ok: true,
    json: async () => ({
      success: false,
      error: { message },
    }),
  };
}

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Default client config for tests
const clientConfig = {
  apiKey: 'bk_test_key',
  baseUrl: 'http://localhost:8080',
};

// =============================================================================
// Provider Inference Tests
// =============================================================================

describe('Provider Inference', () => {
  it('infers openai for gpt-4', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      model: 'gpt-4',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.provider).toBe('openai');
  });

  it('infers openai for gpt-4o', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      model: 'gpt-4o',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.provider).toBe('openai');
  });

  it('infers anthropic for claude-3', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      model: 'claude-3-opus',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.provider).toBe('anthropic');
  });

  it('infers google for gemini', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      model: 'gemini-1.5-pro',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.provider).toBe('google');
  });

  it('defaults to openai for unknown models', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      model: 'unknown-model',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.provider).toBe('openai');
  });
});

// =============================================================================
// Template Rendering Tests
// =============================================================================

describe('Template Rendering', () => {
  it('renders basic variables', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Input: {{input}}, Output: {{output}}',
    });

    await scorer({ input: 'hello', output: 'world' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toBe('Input: hello, Output: world');
  });

  it('renders expected variable', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Expected: {{expected}}',
    });

    await scorer({ output: 'test', expected: 'correct' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toBe('Expected: correct');
  });

  it('renders objects as JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Data: {{input}}',
    });

    await scorer({ input: { key: 'value' }, output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toContain('"key"');
    expect(body.template).toContain('"value"');
  });

  it('renders null/undefined as empty string', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Output: {{output}}',
    });

    await scorer({ output: null });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toBe('Output: ');
  });

  it('handles whitespace in braces', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Value: {{ output }}',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toBe('Value: test');
  });
});

// =============================================================================
// Request Payload Tests
// =============================================================================

describe('Request Payload', () => {
  it('builds basic payload', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toBe('test');
    expect(body.prompt_type).toBe('text');
    expect(body.variables).toEqual({});
    expect(body.config_overrides.model).toBe('gpt-4o');
    expect(body.config_overrides.temperature).toBe(0);
  });

  it('includes credential_id when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      credentialId: 'cred_123',
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.credential_id).toBe('cred_123');
  });

  it('includes max_tokens when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      maxTokens: 500,
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config_overrides.max_tokens).toBe(500);
  });

  it('sends correct headers', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    await scorer({ output: 'test' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-API-Key']).toBe('bk_test_key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    await scorer({ output: 'test' });

    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8080/v1/playground/execute');
  });
});

// =============================================================================
// JSON Response Parsing Tests
// =============================================================================

describe('JSON Response Parsing', () => {
  it('parses numeric score with reason', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"score": 0.85, "reason": "Good response"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'quality',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));

    expect(result.name).toBe('quality');
    expect(result.value).toBe(0.85);
    expect(result.type).toBe(ScoreType.NUMERIC);
    expect(result.reason).toBe('Good response');
    expect(result.scoringFailed).toBeUndefined();
  });

  it('parses value key instead of score', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"value": 0.7}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.7);
  });

  it('parses rating key', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"rating": 8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(8);
  });

  it('parses explanation key as reason', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"score": 0.5, "explanation": "Mediocre"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.reason).toBe('Mediocre');
  });

  it('maps choice scores', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"choice": "B", "reason": "Partially correct"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'factuality',
      prompt: '{{output}}',
      choiceScores: { A: 1.0, B: 0.5, C: 0.0 },
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.5);
    expect(result.type).toBe(ScoreType.CATEGORICAL);
    expect(result.stringValue).toBe('B');
    expect(result.reason).toBe('Partially correct');
  });

  it('handles choice scores case-insensitively', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"choice": "a"}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
      choiceScores: { A: 1.0, B: 0.0 },
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(1.0);
    expect(result.stringValue).toBe('A');
  });

  it('parses multi-score mode', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"accuracy": 0.9, "fluency": 0.8, "reason": "Good"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'multi',
      prompt: '{{output}}',
      multiScore: true,
    });

    const results = asScoreResultArray(await scorer({ output: 'test' }));
    expect(results.length).toBe(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('accuracy');
    expect(names).toContain('fluency');
  });

  it('parses boolean result true', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"result": true}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(1.0);
    expect(result.type).toBe(ScoreType.BOOLEAN);
  });

  it('parses boolean result false', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"result": false}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.0);
    expect(result.type).toBe(ScoreType.BOOLEAN);
  });

  it('includes reasoning in metadata', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"score": 0.9, "reasoning": "Step 1: Check..."}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.metadata?.reasoning).toBe('Step 1: Check...');
  });

  it('extracts JSON from markdown block', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('```json\n{"score": 0.75}\n```')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.75);
  });

  it('returns scoringFailed for unparseable JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"invalid": "no score field"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
    expect(result.value).toBe(0);
  });
});

// =============================================================================
// Text Response Parsing Tests
// =============================================================================

describe('Text Response Parsing', () => {
  it('extracts number from text', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('I would rate this response 8 out of 10.')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.8); // 8/10 normalized
    expect(result.type).toBe(ScoreType.NUMERIC);
  });

  it('extracts decimal number', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('Score: 0.75'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.75);
  });

  it('detects yes response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('Yes, this response is correct.')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(1.0);
    expect(result.type).toBe(ScoreType.BOOLEAN);
  });

  it('detects no response', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('No, this is incorrect.'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.value).toBe(0.0);
    expect(result.type).toBe(ScoreType.BOOLEAN);
  });

  it('returns scoringFailed for text without score', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('This response is interesting but lacks a clear rating.')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
    expect(result.value).toBe(0);
  });
});

// =============================================================================
// Error Handling Tests (Graceful Degradation)
// =============================================================================

describe('Error Handling', () => {
  it('returns scoringFailed on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse('Server error'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
    expect(result.value).toBe(0);
    expect(result.reason).toContain('failed');
  });

  it('returns scoringFailed on API error', async () => {
    mockFetch.mockResolvedValueOnce(makeApiErrorResponse('API failed'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
    expect(result.value).toBe(0);
  });

  it('returns scoringFailed on empty response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { response: { content: '' } },
      }),
    });

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
  });

  it('returns scoringFailed on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result.scoringFailed).toBe(true);
    expect(result.value).toBe(0);
    expect(result.metadata?.error).toContain('Network timeout');
  });

  it('never throws exceptions', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Catastrophic failure'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: '{{output}}',
    });

    // This should NOT throw
    const result = asScoreResult(await scorer({ output: 'test' }));
    expect(result).toBeDefined();
    expect(result.scoringFailed).toBe(true);
  });
});

// =============================================================================
// Chain-of-Thought Tests
// =============================================================================

describe('Chain-of-Thought', () => {
  it('appends CoT instruction when enabled', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Rate: {{output}}',
      useCot: true,
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toContain('Think step-by-step');
  });

  it('does not append CoT instruction when disabled', async () => {
    mockFetch.mockResolvedValueOnce(makeSuccessResponse('{"score": 0.8}'));

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'test',
      prompt: 'Rate: {{output}}',
      useCot: false,
    });

    await scorer({ output: 'test' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).not.toContain('Think step-by-step');
  });
});

// =============================================================================
// Scorer Name Tests
// =============================================================================

describe('Scorer Name', () => {
  it('sets scorer name property', () => {
    const scorer = LLMScorer({
      client: clientConfig,
      name: 'my-scorer',
      prompt: '{{output}}',
    });

    expect(scorer.name).toBe('my-scorer');
  });
});

// =============================================================================
// End-to-End Tests
// =============================================================================

describe('End-to-End', () => {
  it('full workflow with template variables', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"score": 8, "reason": "Answer addresses the question well"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'relevance',
      prompt: 'Question: {{input}}\nAnswer: {{output}}\n\nRate relevance 0-10.',
      model: 'gpt-4o',
    });

    const result = asScoreResult(
      await scorer({
        input: 'What is Python?',
        output: 'Python is a programming language.',
      })
    );

    expect(result.value).toBe(8);
    expect(result.reason).toBe('Answer addresses the question well');

    // Verify template rendering
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.template).toContain('What is Python?');
    expect(body.template).toContain('Python is a programming language.');
  });

  it('classification workflow with choice scores', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse('{"choice": "A", "reason": "Clearly positive language"}')
    );

    const scorer = LLMScorer({
      client: clientConfig,
      name: 'sentiment',
      prompt: 'Classify sentiment of: {{output}}\n(A) Positive (B) Neutral (C) Negative',
      choiceScores: { A: 1.0, B: 0.5, C: 0.0 },
    });

    const result = asScoreResult(await scorer({ output: 'I love this product!' }));
    expect(result.value).toBe(1.0);
    expect(result.type).toBe(ScoreType.CATEGORICAL);
    expect(result.stringValue).toBe('A');
  });
});
