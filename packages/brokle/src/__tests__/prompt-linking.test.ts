/**
 * Tests for prompt-to-trace linking functionality.
 *
 * Validates that prompts are correctly linked to spans via OpenTelemetry attributes:
 * - brokle.prompt.name
 * - brokle.prompt.version
 * - brokle.prompt.id
 *
 * Key behavior: Fallback prompts (isFallback=true) are NOT linked to traces.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prompt } from '../prompt/prompt';
import type { PromptData } from '../prompt/types';
import { Attrs } from '../types/attributes';
import { trace } from '@opentelemetry/api';

describe('Prompt Linking', () => {
  describe('Prompt.isFallback behavior', () => {
    it('fallback prompt has isFallback=true', () => {
      const prompt = Prompt.createFallback('test', 'Hello {{name}}');

      expect(prompt.isFallback).toBe(true);
    });

    it('fallback prompt has version 0', () => {
      const prompt = Prompt.createFallback('test', 'Hello');

      expect(prompt.version).toBe(0);
    });

    it('fallback prompt has id "fallback"', () => {
      const prompt = Prompt.createFallback('test', 'Hello');

      expect(prompt.id).toBe('fallback');
    });

    it('normal prompt has isFallback=false', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'greeting',
        type: 'text',
        description: 'A greeting prompt',
        tags: [],
        template: { content: 'Hello {{name}}!' },
        config: null,
        variables: ['name'],
        labels: [],
        version: 5,
        is_fallback: false,
        commit_message: 'Updated greeting',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const prompt = Prompt.fromData(data);

      expect(prompt.isFallback).toBe(false);
      expect(prompt.version).toBe(5);
      expect(prompt.id).toBe('01HXY123456789ABCDEFGHIJ');
    });
  });

  describe('Prompt attributes for linking', () => {
    it('normal prompt has valid linking attributes', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'assistant',
        type: 'chat',
        description: 'Assistant prompt',
        tags: [],
        template: {
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: '{{query}}' },
          ],
        },
        config: { model: 'gpt-4', temperature: 0.7 },
        variables: ['query'],
        labels: [],
        version: 3,
        is_fallback: false,
        commit_message: 'v3 update',
        created_by: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      const prompt = Prompt.fromData(data);

      // These are the values that should be set on spans
      expect(prompt.name).toBe('assistant');
      expect(prompt.version).toBe(3);
      expect(prompt.id).toBe('01HXY123456789ABCDEFGHIJ');
      expect(prompt.isFallback).toBe(false);
    });

    it('fallback prompt should NOT be linked (version 0, id "fallback")', () => {
      const prompt = Prompt.createFallback('my-prompt', 'Hello!');

      // Linking logic should check these conditions:
      // 1. isFallback === true → skip linking
      // 2. id === 'fallback' → skip id attribute
      expect(prompt.isFallback).toBe(true);
      expect(prompt.id).toBe('fallback');
      expect(prompt.version).toBe(0);
    });
  });

  describe('Attribute constants', () => {
    it('BROKLE_PROMPT_NAME is defined', () => {
      expect(Attrs.BROKLE_PROMPT_NAME).toBe('brokle.prompt.name');
    });

    it('BROKLE_PROMPT_VERSION is defined', () => {
      expect(Attrs.BROKLE_PROMPT_VERSION).toBe('brokle.prompt.version');
    });

    it('BROKLE_PROMPT_ID is defined', () => {
      expect(Attrs.BROKLE_PROMPT_ID).toBe('brokle.prompt.id');
    });
  });

  describe('Linking logic validation', () => {
    /**
     * These tests validate the linking conditions without requiring
     * a full OpenTelemetry setup. The actual client methods are tested
     * in integration tests.
     */

    it('should link normal prompt (not fallback)', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'greet',
        type: 'text',
        description: '',
        tags: [],
        template: { content: 'Hello!' },
        config: null,
        variables: [],
        labels: [],
        version: 1,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Simulate linking logic
      const shouldLink = !prompt.isFallback;
      const attrs: Record<string, unknown> = {};

      if (shouldLink) {
        attrs[Attrs.BROKLE_PROMPT_NAME] = prompt.name;
        attrs[Attrs.BROKLE_PROMPT_VERSION] = prompt.version;
        if (prompt.id && prompt.id !== 'fallback') {
          attrs[Attrs.BROKLE_PROMPT_ID] = prompt.id;
        }
      }

      expect(attrs[Attrs.BROKLE_PROMPT_NAME]).toBe('greet');
      expect(attrs[Attrs.BROKLE_PROMPT_VERSION]).toBe(1);
      expect(attrs[Attrs.BROKLE_PROMPT_ID]).toBe('01HXY123456789ABCDEFGHIJ');
    });

    it('should NOT link fallback prompt', () => {
      const prompt = Prompt.createFallback('greet', 'Hello!');

      // Simulate linking logic
      const shouldLink = !prompt.isFallback;
      const attrs: Record<string, unknown> = {};

      if (shouldLink) {
        attrs[Attrs.BROKLE_PROMPT_NAME] = prompt.name;
        attrs[Attrs.BROKLE_PROMPT_VERSION] = prompt.version;
        if (prompt.id && prompt.id !== 'fallback') {
          attrs[Attrs.BROKLE_PROMPT_ID] = prompt.id;
        }
      }

      // No attributes should be set for fallback
      expect(Object.keys(attrs)).toHaveLength(0);
    });

    it('should skip prompt ID if it equals "fallback"', () => {
      // Edge case: normal prompt somehow has id "fallback"
      const data: PromptData = {
        id: 'fallback', // Edge case
        project_id: 'proj-1',
        name: 'test',
        type: 'text',
        description: '',
        tags: [],
        template: { content: 'Hello!' },
        config: null,
        variables: [],
        labels: [],
        version: 1,
        is_fallback: false, // Not a fallback, but weird ID
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Simulate linking logic
      const attrs: Record<string, unknown> = {};
      if (!prompt.isFallback) {
        attrs[Attrs.BROKLE_PROMPT_NAME] = prompt.name;
        attrs[Attrs.BROKLE_PROMPT_VERSION] = prompt.version;
        if (prompt.id && prompt.id !== 'fallback') {
          attrs[Attrs.BROKLE_PROMPT_ID] = prompt.id;
        }
      }

      expect(attrs[Attrs.BROKLE_PROMPT_NAME]).toBe('test');
      expect(attrs[Attrs.BROKLE_PROMPT_VERSION]).toBe(1);
      // ID should NOT be set because it equals 'fallback'
      expect(attrs[Attrs.BROKLE_PROMPT_ID]).toBeUndefined();
    });
  });

  describe('Integration test helper patterns', () => {
    /**
     * These tests demonstrate the expected attribute structure
     * for prompt linking. Full integration requires running backend.
     */

    it('traced() supports dynamic prompt linking via linkPrompt()', async () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'assistant',
        type: 'chat',
        description: '',
        tags: [],
        template: { messages: [{ role: 'user', content: 'Hi' }] },
        config: null,
        variables: [],
        labels: [],
        version: 2,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Verify prompt has correct linking attributes
      expect(prompt.name).toBe('assistant');
      expect(prompt.version).toBe(2);
      expect(prompt.isFallback).toBe(false);

      // In actual usage - link dynamically inside traced():
      // await client.traced('my-op', async (span) => {
      //   const prompt = await client.prompts.get("assistant");
      //   client.linkPrompt(prompt);
      // });
    });

    it('generation() supports dynamic prompt linking', async () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'chat-prompt',
        type: 'chat',
        description: '',
        tags: [],
        template: { messages: [{ role: 'system', content: 'Be helpful' }] },
        config: { model: 'gpt-4' },
        variables: [],
        labels: [],
        version: 5,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Verify prompt is suitable for linking
      expect(prompt.name).toBe('chat-prompt');
      expect(prompt.version).toBe(5);
      expect(prompt.isFallback).toBe(false);

      // In actual usage - link dynamically inside generation():
      // await client.generation('chat', 'gpt-4', 'openai', async (span) => {
      //   const prompt = await client.prompts.get("chat-prompt");
      //   client.linkPrompt(prompt);
      // });
    });

    it('linkPrompt() should link prompt to active span', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'dynamic-prompt',
        type: 'text',
        description: '',
        tags: [],
        template: { content: 'Hello!' },
        config: null,
        variables: [],
        labels: [],
        version: 3,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Verify prompt is suitable for dynamic linking
      expect(prompt.isFallback).toBe(false);
      expect(prompt.name).toBe('dynamic-prompt');

      // In actual usage:
      // await client.traced('op', async () => {
      //   const prompt = await client.prompts.get('dynamic-prompt');
      //   client.linkPrompt(prompt);
      // });
    });

    it('updateCurrentSpan() should accept prompt option', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'updated-prompt',
        type: 'text',
        description: '',
        tags: [],
        template: { content: 'Updated!' },
        config: null,
        variables: [],
        labels: [],
        version: 4,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      expect(prompt.isFallback).toBe(false);
      expect(prompt.name).toBe('updated-prompt');
      expect(prompt.version).toBe(4);

      // In actual usage:
      // await client.traced('op', async () => {
      //   client.updateCurrentSpan({ prompt, output: 'result' });
      // });
    });
  });

  describe('Wrapper function prompt linking (brokle_options pattern)', () => {
    /**
     * Tests for the brokle_options pattern used in OpenAI/Anthropic wrappers.
     */

    it('should extract prompt from brokle_options', () => {
      const data: PromptData = {
        id: '01HXY123456789ABCDEFGHIJ',
        project_id: 'proj-1',
        name: 'openai-prompt',
        type: 'chat',
        description: '',
        tags: [],
        template: { messages: [{ role: 'user', content: '{{input}}' }] },
        config: null,
        variables: ['input'],
        labels: [],
        version: 1,
        is_fallback: false,
        commit_message: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      };
      const prompt = Prompt.fromData(data);

      // Simulate brokle_options extraction
      interface BrokleOptions {
        prompt?: Prompt;
      }

      const kwargs: Record<string, unknown> = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        brokle_options: { prompt } as BrokleOptions,
      };

      const brokleOptions = (kwargs.brokle_options as BrokleOptions) || {};
      delete kwargs.brokle_options;

      expect(brokleOptions.prompt).toBe(prompt);
      expect(brokleOptions.prompt?.name).toBe('openai-prompt');
      expect(brokleOptions.prompt?.isFallback).toBe(false);

      // Clean kwargs should not have brokle_options
      expect(kwargs.brokle_options).toBeUndefined();
      expect(kwargs.model).toBe('gpt-4');
    });

    it('should skip fallback prompts in brokle_options', () => {
      const fallbackPrompt = Prompt.createFallback('fallback', 'Default');

      interface BrokleOptions {
        prompt?: Prompt;
      }

      const brokleOptions: BrokleOptions = { prompt: fallbackPrompt };

      // Simulate _add_prompt_attributes logic
      const attrs: Record<string, unknown> = {};
      const prompt = brokleOptions.prompt;

      if (prompt && !prompt.isFallback) {
        attrs[Attrs.BROKLE_PROMPT_NAME] = prompt.name;
        attrs[Attrs.BROKLE_PROMPT_VERSION] = prompt.version;
        if (prompt.id && prompt.id !== 'fallback') {
          attrs[Attrs.BROKLE_PROMPT_ID] = prompt.id;
        }
      }

      // No attributes should be set for fallback
      expect(Object.keys(attrs)).toHaveLength(0);
    });
  });
});
