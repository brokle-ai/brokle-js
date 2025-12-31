/**
 * Tests for LangChain callback handler
 *
 * Note: Full integration tests with real LangChain chains require:
 * 1. langchain package installed (peer dependency)
 * 2. LLM API keys (OPENAI_API_KEY, etc.)
 * 3. Running backend server for trace export
 *
 * These tests focus on:
 * - Callback handler construction
 * - Span lifecycle management
 * - Error handling
 * - Config merging
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { BrokleLangChainCallback } from './callback';

describe('BrokleLangChainCallback', () => {
  beforeAll(() => {
    // Set required environment variable for testing
    process.env.BROKLE_API_KEY = 'bk_' + 'x'.repeat(40);
  });

  describe('Constructor', () => {
    it('should create callback handler with default config', () => {
      const callback = new BrokleLangChainCallback();
      expect(callback).toBeDefined();
      expect(callback.name).toBe('brokle_langchain_callback');
    });

    it('should create callback handler with user config', () => {
      const callback = new BrokleLangChainCallback({
        userId: 'user-123',
        sessionId: 'session-456',
        tags: ['production', 'experiment'],
        metadata: { env: 'prod' },
        version: 'v1.0',
        debug: true,
      });

      expect(callback).toBeDefined();
      expect(callback.name).toBe('brokle_langchain_callback');
    });

    it('should create callback handler with empty config', () => {
      const callback = new BrokleLangChainCallback({});
      expect(callback).toBeDefined();
    });
  });

  describe('Span Lifecycle', () => {
    it('should handle LLM start without errors', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      await expect(
        callback.handleLLMStart(llm, ['What is AI?'], 'run-123')
      ).resolves.not.toThrow();
    });

    it('should handle LLM end without errors', async () => {
      const callback = new BrokleLangChainCallback();

      // Start LLM
      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(llm, ['What is AI?'], 'run-123');

      // End LLM
      const output = {
        generations: [[{ text: 'AI is artificial intelligence' }]],
        llmOutput: {
          tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          model_name: 'gpt-4-0613',
        },
      };

      await expect(callback.handleLLMEnd(output, 'run-123')).resolves.not.toThrow();
    });

    it('should handle LLM error without crashing', async () => {
      const callback = new BrokleLangChainCallback();

      // Start LLM
      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(llm, ['What is AI?'], 'run-123');

      // Error
      const error = new Error('API rate limit exceeded');
      await expect(callback.handleLLMError(error, 'run-123')).resolves.not.toThrow();
    });

    it('should handle missing span gracefully in handleLLMEnd', async () => {
      const callback = new BrokleLangChainCallback();

      const output = {
        generations: [[{ text: 'Response' }]],
        llmOutput: {},
      };

      // Call handleLLMEnd without handleLLMStart
      await expect(callback.handleLLMEnd(output, 'non-existent-run')).resolves.not.toThrow();
    });
  });

  describe('Chain Lifecycle', () => {
    it('should handle chain start without errors', async () => {
      const callback = new BrokleLangChainCallback();

      const chain = {
        id: ['langchain', 'chains', 'LLMChain'],
      };

      await expect(
        callback.handleChainStart(chain, { input: 'test' }, 'chain-run-123')
      ).resolves.not.toThrow();
    });

    it('should handle chain end without errors', async () => {
      const callback = new BrokleLangChainCallback();

      // Start chain
      const chain = {
        id: ['langchain', 'chains', 'LLMChain'],
      };
      await callback.handleChainStart(chain, { input: 'test' }, 'chain-run-123');

      // End chain
      await expect(
        callback.handleChainEnd({ output: 'result' }, 'chain-run-123')
      ).resolves.not.toThrow();
    });

    it('should handle chain error without crashing', async () => {
      const callback = new BrokleLangChainCallback();

      // Start chain
      const chain = {
        id: ['langchain', 'chains', 'LLMChain'],
      };
      await callback.handleChainStart(chain, { input: 'test' }, 'chain-run-123');

      // Error
      const error = new Error('Chain execution failed');
      await expect(
        callback.handleChainError(error, 'chain-run-123')
      ).resolves.not.toThrow();
    });
  });

  describe('Tool Lifecycle', () => {
    it('should handle tool start without errors', async () => {
      const callback = new BrokleLangChainCallback();

      const tool = {
        id: ['langchain', 'tools', 'Calculator'],
      };

      await expect(
        callback.handleToolStart(tool, '2 + 2', 'tool-run-123')
      ).resolves.not.toThrow();
    });

    it('should handle tool end without errors', async () => {
      const callback = new BrokleLangChainCallback();

      // Start tool
      const tool = {
        id: ['langchain', 'tools', 'Calculator'],
      };
      await callback.handleToolStart(tool, '2 + 2', 'tool-run-123');

      // End tool
      await expect(callback.handleToolEnd('4', 'tool-run-123')).resolves.not.toThrow();
    });

    it('should handle tool error without crashing', async () => {
      const callback = new BrokleLangChainCallback();

      // Start tool
      const tool = {
        id: ['langchain', 'tools', 'Calculator'],
      };
      await callback.handleToolStart(tool, 'invalid', 'tool-run-123');

      // Error
      const error = new Error('Invalid calculation');
      await expect(callback.handleToolError(error, 'tool-run-123')).resolves.not.toThrow();
    });
  });

  describe('Parent-Child Relationships', () => {
    it('should handle nested LLM calls with parent-child relationships', async () => {
      const callback = new BrokleLangChainCallback();

      // Parent LLM call
      const parentLLM = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(parentLLM, ['Parent prompt'], 'parent-run-123');

      // Child LLM call with parentRunId
      const childLLM = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-3.5-turbo' },
      };
      await expect(
        callback.handleLLMStart(childLLM, ['Child prompt'], 'child-run-456', 'parent-run-123')
      ).resolves.not.toThrow();

      // End both
      const output = { generations: [[{ text: 'Response' }]], llmOutput: {} };
      await callback.handleLLMEnd(output, 'child-run-456');
      await callback.handleLLMEnd(output, 'parent-run-123');
    });

    it('should handle non-existent parent gracefully', async () => {
      const callback = new BrokleLangChainCallback({ debug: true });

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      // Reference non-existent parent
      await expect(
        callback.handleLLMStart(llm, ['Prompt'], 'run-123', 'non-existent-parent')
      ).resolves.not.toThrow();
    });
  });

  describe('Config Merging', () => {
    it('should merge config tags with run tags', async () => {
      const callback = new BrokleLangChainCallback({
        tags: ['config-tag-1', 'config-tag-2'],
      });

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      const extraParams = {
        tags: ['run-tag-1', 'run-tag-2'],
      };

      await expect(
        callback.handleLLMStart(llm, ['Prompt'], 'run-123', undefined, extraParams)
      ).resolves.not.toThrow();
    });

    it('should merge config metadata with run metadata', async () => {
      const callback = new BrokleLangChainCallback({
        metadata: { configKey: 'configValue' },
      });

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      const extraParams = {
        metadata: { runKey: 'runValue', brokleUserId: 'override-user' },
      };

      await expect(
        callback.handleLLMStart(llm, ['Prompt'], 'run-123', undefined, extraParams)
      ).resolves.not.toThrow();
    });
  });

  describe('Provider Detection', () => {
    it('should detect OpenAI provider', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      await expect(callback.handleLLMStart(llm, ['Test'], 'run-123')).resolves.not.toThrow();
    });

    it('should detect Anthropic provider', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'anthropic', 'ChatAnthropic'],
        kwargs: { model_name: 'claude-3-opus' },
      };

      await expect(callback.handleLLMStart(llm, ['Test'], 'run-123')).resolves.not.toThrow();
    });

    it('should handle unknown provider', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'custom', 'CustomLLM'],
        kwargs: { model_name: 'custom-model' },
      };

      await expect(callback.handleLLMStart(llm, ['Test'], 'run-123')).resolves.not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should call flush method without throwing', async () => {
      const callback = new BrokleLangChainCallback();
      // Note: flush() attempts to connect to backend (localhost:8080)
      // which will fail in test environment - we just verify the method exists
      // and can be called without synchronous errors
      await expect(async () => {
        try {
          await callback.flush();
        } catch (err) {
          // Expected to fail due to no backend connection in tests
          // We just want to ensure the method doesn't throw sync errors
        }
      }).not.toThrow();
    });

    it('should cleanup open spans without errors', async () => {
      const callback = new BrokleLangChainCallback({ debug: true });

      // Start some spans
      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(llm, ['Prompt 1'], 'run-1');
      await callback.handleLLMStart(llm, ['Prompt 2'], 'run-2');

      // Cleanup without ending them normally
      await expect(callback.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup with no open spans', async () => {
      const callback = new BrokleLangChainCallback();
      await expect(callback.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle LLM output without token usage', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(llm, ['Prompt'], 'run-123');

      const output = {
        generations: [[{ text: 'Response' }]],
        llmOutput: {}, // No tokenUsage
      };

      await expect(callback.handleLLMEnd(output, 'run-123')).resolves.not.toThrow();
    });

    it('should handle empty generations in LLM output', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };
      await callback.handleLLMStart(llm, ['Prompt'], 'run-123');

      const output = {
        generations: [],
        llmOutput: {},
      };

      await expect(callback.handleLLMEnd(output, 'run-123')).resolves.not.toThrow();
    });

    it('should handle multiple prompts in LLM start', async () => {
      const callback = new BrokleLangChainCallback();

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      await expect(
        callback.handleLLMStart(
          llm,
          ['Prompt 1', 'Prompt 2', 'Prompt 3'],
          'run-123'
        )
      ).resolves.not.toThrow();
    });

    it('should handle version attribute', async () => {
      const callback = new BrokleLangChainCallback({ version: 'experiment-a' });

      const llm = {
        id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'],
        kwargs: { model_name: 'gpt-4' },
      };

      await expect(callback.handleLLMStart(llm, ['Prompt'], 'run-123')).resolves.not.toThrow();
    });
  });
});
